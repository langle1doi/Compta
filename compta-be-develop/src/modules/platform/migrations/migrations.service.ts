import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ControlEventsService } from '../../../database/control-events.service';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { Prisma } from '../../../generated/control/client';
import { ProvisioningJobStatus, ProvisioningJobType, TenantStatus } from '../../../generated/control/enums';
import { QueueName } from '../../queue/queue-names';
import { QueueService } from '../../queue/queue.service';
import { TenantRegistryService } from '../../tenancy/tenant-registry.service';
import type { PlatformActor } from '../audit/platform-actor';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { JobsService, parseJobMessage } from '../jobs/jobs.service';
import { latestTenantSchemaVersion } from '../tenants/tenant-migrator';
import type { ListMigrationsQuery } from './dto/list-migrations.query';
import { migrateOneTenant } from './tenant-migration';

const MIGRATABLE: TenantStatus[] = [TenantStatus.ACTIVE, TenantStatus.SUSPENDED];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TenantResult {
  tenantId: string;
  subdomain?: string;
  status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  schemaVersion?: string | null;
  reason?: string;
}

/** F01 AC-06: one job, tenants one after another, each with its own result. A failing tenant does not stop the others. */
@Injectable()
export class MigrationsService implements OnModuleInit {
  private readonly logger = new Logger(MigrationsService.name);

  constructor(
    private readonly control: ControlPrismaService,
    private readonly registry: TenantRegistryService,
    private readonly events: ControlEventsService,
    private readonly jobs: JobsService,
    private readonly queue: QueueService,
    private readonly audit: PlatformAuditService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.queue.registerConsumer(QueueName.MIGRATION, {
      handle: (message) => this.run(parseJobMessage(message)),
      onDeadLetter: (message) => this.jobs.fail(parseJobMessage(message), { reason: 'failed, see the server log' }),
    });
  }

  async status(query: ListMigrationsQuery) {
    const latestVersion = latestTenantSchemaVersion();
    const where: Prisma.TenantWhereInput = {
      status: { in: MIGRATABLE },
      ...(query.outdated === true && { OR: [{ schemaVersion: { not: latestVersion } }, { schemaVersion: null }] }),
      ...(query.outdated === false && { schemaVersion: latestVersion }),
    };
    const [rows, total, activeJob] = await Promise.all([
      this.control.tenant.findMany({
        where,
        select: { id: true, name: true, subdomain: true, status: true, schemaVersion: true },
        orderBy: [{ subdomain: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.control.tenant.count({ where }),
      this.control.provisioningJob.findFirst({
        where: { type: ProvisioningJobType.MIGRATE, status: { in: [ProvisioningJobStatus.QUEUED, ProvisioningJobStatus.RUNNING] } },
        select: { id: true },
      }),
    ]);
    return {
      latestVersion,
      activeJobId: activeJob?.id ?? null,
      items: rows.map(({ schemaVersion, ...tenant }) => ({ tenant, schemaVersion, isOutdated: schemaVersion !== latestVersion })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** E-MIG-01: a partial unique index allows one active migration on the whole platform. */
  async start(tenantIds: string[] | undefined, actor: PlatformActor) {
    const result = { requested: tenantIds ?? null, results: [] };
    try {
      const job = await this.control.$transaction(async (tx) => {
        const created = await tx.provisioningJob.create({ data: { type: ProvisioningJobType.MIGRATE, createdBy: actor.adminId, result } });
        await this.audit.record(actor, { action: 'migration.run', targetType: 'job', targetId: created.id, after: { tenantIds } }, tx);
        return created;
      });
      await this.jobs.publish(job);
      return { jobId: job.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.JOB_ALREADY_RUNNING, 'A migration is already running');
      }
      throw error;
    }
  }

  run(jobId: string): Promise<void> {
    return this.jobs.runExclusive(jobId, () => this.execute(jobId));
  }

  private async execute(jobId: string) {
    const job = await this.jobs.begin(jobId);
    if (!job) return;
    const requested = (job.result as { requested?: string[] | null } | null)?.requested ?? null;
    const results: TenantResult[] = [];
    const save = () => this.jobs.progress(jobId, { requested, results, ...summarize(results) });

    // Tenants created while this runs migrate themselves to the build's latest version when provisioned (E-MIG-03)
    const validIds = requested?.filter((id) => UUID_RE.test(id));
    const tenants = await this.control.tenant.findMany({
      where: requested ? { id: { in: validIds } } : { status: { in: MIGRATABLE } },
      orderBy: { createdAt: 'asc' },
    });
    for (const id of requested ?? []) {
      if (!tenants.some((t) => t.id === id)) results.push({ tenantId: id, status: 'SKIPPED', reason: 'unknown tenant' });
    }
    await this.jobs.step(jobId, 'migrate');
    for (const tenant of tenants) {
      const base = { tenantId: tenant.id, subdomain: tenant.subdomain };
      if (!MIGRATABLE.includes(tenant.status)) {
        results.push({ ...base, status: 'SKIPPED', reason: `tenant is ${tenant.status}` });
        continue;
      }
      try {
        const { schemaVersion } = await migrateOneTenant(
          { control: this.control, registry: this.registry, events: this.events, config: this.config },
          tenant,
        );
        results.push({ ...base, status: 'SUCCEEDED', schemaVersion });
      } catch (error) {
        this.logger.error({ err: error, tenantId: tenant.id, jobId }, 'Tenant migration failed');
        results.push({ ...base, status: 'FAILED', schemaVersion: tenant.schemaVersion, reason: 'failed, see the server log' });
      }
      await save();
    }
    await this.jobs.step(jobId, 'migrate', 'DONE');
    await this.jobs.succeed(jobId, { requested, results, ...summarize(results) });
  }
}

const summarize = (results: TenantResult[]) => ({
  succeeded: results.filter((r) => r.status === 'SUCCEEDED').length,
  failed: results.filter((r) => r.status === 'FAILED').length,
  skipped: results.filter((r) => r.status === 'SKIPPED').length,
});
