import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpStatus, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ADVISORY_LOCKS, withAdvisoryLock } from '../../../database/advisory-lock';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { Prisma, Tenant } from '../../../generated/control/client';
import { ProvisioningJobStatus, ProvisioningJobType, TenantStatus } from '../../../generated/control/enums';
import { exportReadyMail } from '../../mail/mail-templates';
import { MailService } from '../../mail/mail.service';
import { QueueName } from '../../queue/queue-names';
import { QueueService } from '../../queue/queue.service';
import { StorageService, TENANT_EXPORTS_DIR, tenantObjectKey } from '../../storage/storage.service';
import { TenantRegistryService } from '../../tenancy/tenant-registry.service';
import { JOB_PUBLIC_FIELDS, JobsService, parseJobMessage } from '../jobs/jobs.service';
import { writeTenantExport } from './tenant-export-writer';

/** F01 G */
export const EXPORT_LINK_SECONDS = 24 * 60 * 60;

const ACTIVE_JOB = [ProvisioningJobStatus.QUEUED, ProvisioningJobStatus.RUNNING];
const SWEEP_EVERY_MS = 15 * 60 * 1000;

const objectKey = (tenantId: string, jobId: string) => tenantObjectKey(tenantId, `${TENANT_EXPORTS_DIR}/${jobId}.zip`);

interface ExportResult {
  requestedBy?: string | null;
  expiresAt?: string;
  sizeBytes?: number;
  reason?: string;
}

type PublicJob = Prisma.ProvisioningJobGetPayload<{ select: typeof JOB_PUBLIC_FIELDS }>;

/** US-05: everything the tenant has, as a zip in object storage, reachable for 24 hours through a presigned link. */
@Injectable()
export class TenantExportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantExportsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly control: ControlPrismaService,
    private readonly jobs: JobsService,
    private readonly queue: QueueService,
    private readonly registry: TenantRegistryService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.queue.registerConsumer(QueueName.EXPORT, {
      handle: (message) => this.run(parseJobMessage(message)),
      onDeadLetter: (message) => this.jobs.fail(parseJobMessage(message), { reason: 'failed, see the server log' }),
    });
  }

  /** E-EXP-04: asking twice gives the job already under way, not a second one. */
  async request(
    tenant: Pick<Tenant, 'id'>,
    createdBy: string | undefined,
    requestedBy: string | null,
    audit: (jobId: string, tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    // Known to be down: say so now rather than accept a job that can only fail (the next request sees the fresh state)
    if (!this.storage.isAvailable()) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.STORAGE_UNAVAILABLE,
        'File storage is not available, try again shortly',
      );
    }
    try {
      const job = await this.control.$transaction(async (tx) => {
        const created = await tx.provisioningJob.create({
          data: { type: ProvisioningJobType.EXPORT, tenantId: tenant.id, createdBy, result: { requestedBy } },
        });
        await audit(created.id, tx);
        return created;
      });
      await this.jobs.publish(job);
      return { jobId: job.id, alreadyRunning: false };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const active = await this.control.provisioningJob.findFirstOrThrow({
        where: { type: ProvisioningJobType.EXPORT, tenantId: tenant.id, status: { in: ACTIVE_JOB } },
        select: { id: true },
      });
      return { jobId: active.id, alreadyRunning: true };
    }
  }

  assertExportableByPlatform(tenant: Pick<Tenant, 'status'>) {
    if (tenant.status !== TenantStatus.SUSPENDED && tenant.status !== TenantStatus.DELETED) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.TENANT_NOT_EXPORTABLE,
        'Only a suspended or deleted tenant can be exported from here',
      );
    }
  }

  run(jobId: string): Promise<void> {
    return this.jobs.runExclusive(jobId, () => this.execute(jobId));
  }

  private async execute(jobId: string) {
    const job = await this.jobs.begin(jobId);
    if (!job?.tenantId) return;
    const requestedBy = (job.result as ExportResult | null)?.requestedBy ?? null;
    const tenant = await this.control.tenant.findUnique({ where: { id: job.tenantId } });
    if (!tenant) return this.jobs.fail(jobId, { requestedBy, reason: 'tenant no longer exists' });

    const dir = await mkdtemp(join(tmpdir(), 'tenant-export-'));
    try {
      await this.jobs.step(jobId, 'export');
      const zipPath = join(dir, 'export.zip');
      const tables = await writeTenantExport(this.registry.ownerConnectionString(tenant), dir, zipPath, () => this.jobs.touch(jobId));
      await this.jobs.step(jobId, 'export', 'DONE');
      await this.jobs.step(jobId, 'upload');
      const key = objectKey(tenant.id, jobId);
      const sizeBytes = await this.storage.putFile(key, zipPath, 'application/zip');
      await this.jobs.step(jobId, 'upload', 'DONE');
      const expiresAt = new Date(Date.now() + EXPORT_LINK_SECONDS * 1000);
      await this.jobs.succeed(jobId, { requestedBy, tables, sizeBytes, expiresAt: expiresAt.toISOString() });
      await this.notify(tenant, key, requestedBy, expiresAt);
    } catch (error) {
      // E-EXP-05: the row says it failed; asking again starts a new job
      this.logger.error({ err: error, tenantId: tenant.id, jobId }, 'Tenant export failed');
      const unavailable = error instanceof AppException && error.code === ErrorCode.STORAGE_UNAVAILABLE;
      await this.jobs.fail(jobId, {
        requestedBy,
        reason: unavailable ? 'file storage is not available, try again' : 'failed, see the server log',
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async notify(tenant: Tenant, key: string, to: string | null, expiresAt: Date) {
    if (!to) return;
    try {
      const url = await this.storage.presignedDownloadUrl(key, EXPORT_LINK_SECONDS, `${tenant.subdomain}-export.zip`);
      await this.mail.enqueue('export_ready', tenant.id, { to, ...exportReadyMail(url, expiresAt) });
    } catch (error) {
      this.logger.warn({ tenantId: tenant.id, code: (error as { code?: string }).code }, 'Could not send the export link');
    }
  }

  async list(tenantId: string) {
    const jobs = await this.control.provisioningJob.findMany({
      where: { type: ProvisioningJobType.EXPORT, tenantId },
      select: JOB_PUBLIC_FIELDS,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return Promise.all(jobs.map((job) => this.view(tenantId, job)));
  }

  /** The tenant is part of the lookup: an id from another tenant answers 404 (E-EXP-06). */
  async get(tenantId: string, jobId: string) {
    const job = await this.control.provisioningJob.findFirst({
      where: { id: jobId, type: ProvisioningJobType.EXPORT, tenantId },
      select: JOB_PUBLIC_FIELDS,
    });
    if (!job) throw new NotFoundException('Export not found');
    return this.view(tenantId, job);
  }

  /** The link is signed for what is left of the 24 hours, so reading the job again never extends it. */
  private async view(tenantId: string, job: PublicJob) {
    const expiresAt = (job.result as ExportResult | null)?.expiresAt;
    const left = expiresAt ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000) : 0;
    const ready = job.status === ProvisioningJobStatus.SUCCEEDED && left > 0;
    return {
      ...job,
      expired: job.status === ProvisioningJobStatus.SUCCEEDED && !ready,
      downloadUrl: ready ? await this.storage.presignedDownloadUrl(objectKey(tenantId, job.id), left, 'export.zip') : null,
    };
  }

  /**
   * BR-06: purge only runs on a tenant whose final data was exported: an export made before the tenant was frozen would
   * miss what came after. The zip itself is gone 24 hours later (deleteExpired), so only the job can tell.
   */
  async hasFinalExport(tenant: Pick<Tenant, 'id' | 'suspendedAt' | 'deletedAt'>) {
    const frozenAt = tenant.suspendedAt ?? tenant.deletedAt;
    const count = await this.control.provisioningJob.count({
      where: {
        type: ProvisioningJobType.EXPORT,
        tenantId: tenant.id,
        status: ProvisioningJobStatus.SUCCEEDED,
        ...(frozenAt && { createdAt: { gte: frozenAt } }),
      },
    });
    return count > 0;
  }

  startSweeper() {
    this.timer ??= setInterval(() => void this.deleteExpired(), SWEEP_EVERY_MS).unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /**
   * Exports hold customer data: the zip goes as soon as its link has expired. A failed job may have left one too.
   * One pod at a time. Never throws: it runs from a timer; what could not be deleted is tried again next round.
   */
  async deleteExpired(now = new Date()) {
    let deleted = 0;
    try {
      await withAdvisoryLock(this.config.getOrThrow<string>('CONTROL_DATABASE_URL'), ADVISORY_LOCKS.EXPORT_SWEEP, async () => {
        const jobs = await this.control.provisioningJob.findMany({
          where: {
            type: ProvisioningJobType.EXPORT,
            tenantId: { not: null },
            fileDeletedAt: null,
            status: { in: [ProvisioningJobStatus.SUCCEEDED, ProvisioningJobStatus.FAILED] },
            finishedAt: { lt: new Date(now.getTime() - EXPORT_LINK_SECONDS * 1000) },
          },
          select: { id: true, tenantId: true },
        });
        for (const job of jobs) {
          if (!job.tenantId) continue;
          try {
            await this.storage.delete(objectKey(job.tenantId, job.id));
            await this.control.provisioningJob.update({ where: { id: job.id }, data: { fileDeletedAt: now } });
            deleted++;
          } catch (error) {
            this.logger.warn(
              { jobId: job.id, code: (error as { code?: string }).code },
              'Could not delete an expired export, will try again',
            );
          }
        }
      });
    } catch (error) {
      this.logger.warn({ code: (error as { code?: string }).code }, 'Export sweep did not run');
    }
    return deleted;
  }
}
