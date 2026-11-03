import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptSecret } from '../../../common/crypto/secret-box';
import { ControlEventsService } from '../../../database/control-events.service';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { TenantPrismaManager } from '../../../database/tenant-prisma.manager';
import { Prisma, Tenant } from '../../../generated/control/client';
import { TenantStatus } from '../../../generated/control/enums';
import { UserStatus } from '../../../generated/tenant/enums';
import { QueueName } from '../../queue/queue-names';
import { QueueService } from '../../queue/queue.service';
import { ensureTenantAppRole } from '../../tenancy/tenant-app-role';
import { TenantRegistryService } from '../../tenancy/tenant-registry.service';
import { InvitationsService } from '../../users/invitations.service';
import { JobsService, parseJobMessage } from '../jobs/jobs.service';
import { migrateTenantDatabase } from './tenant-migrator';
import { TenantDbNameConflictError, TenantProvisionerService } from './tenant-provisioner.service';
import { seedTenant } from './tenant-seeder';
import { TenantUsageService } from './tenant-usage.service';

/** Order shown to the Super Admin (F01 D). */
export const PROVISIONING_STEPS = ['create_database', 'migrate', 'seed', 'invite'] as const;
type Step = (typeof PROVISIONING_STEPS)[number];

// Its role is dropped together with the database; a password kept for it would not open the next one
const NO_APP_ROLE = { dbAppUser: null, dbAppPasswordEnc: null };

/** Non-secret data needed to (re)run provisioning */
export interface ProvisioningInput {
  companyLegalName: string;
  companyCountryCode?: string;
  companyCurrency?: string;
  adminEmail: string;
  adminFullName: string;
}

/** Runs the steps of a PROVISION job, from the queue or inline (seed-control). */
@Injectable()
export class TenantProvisioningService implements OnModuleInit {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(
    private readonly control: ControlPrismaService,
    private readonly provisioner: TenantProvisionerService,
    private readonly registry: TenantRegistryService,
    private readonly manager: TenantPrismaManager,
    private readonly events: ControlEventsService,
    private readonly jobs: JobsService,
    private readonly queue: QueueService,
    private readonly usage: TenantUsageService,
    private readonly config: ConfigService,
    private readonly invitations: InvitationsService,
  ) {}

  onModuleInit() {
    this.queue.registerConsumer(QueueName.PROVISIONING, {
      handle: (message) => this.run(parseJobMessage(message)),
      onDeadLetter: (message) => this.onDeadLetter(message),
    });
  }

  /** Idempotent: a delivery of a finished job does nothing, a delivery after a crash starts over from what is left. */
  run(jobId: string): Promise<void> {
    return this.jobs.runExclusive(jobId, () => this.execute(jobId));
  }

  private async execute(jobId: string) {
    const job = await this.jobs.begin(jobId);
    if (!job?.tenantId) return;
    const tenant = await this.control.tenant.findUnique({ where: { id: job.tenantId } });
    if (!tenant) return this.jobs.fail(jobId, { reason: 'tenant no longer exists' });
    // E-TEN-07: the worker died after activation. The tenant must not be touched, only the last step is left.
    if (tenant.status === TenantStatus.ACTIVE) return this.finishActive(jobId, tenant);
    if (tenant.status !== TenantStatus.PROVISIONING) return this.jobs.fail(jobId, { reason: `tenant is ${tenant.status}` });

    let step: Step = 'create_database';
    try {
      const input = tenant.provisioningInput as unknown as ProvisioningInput;
      const passwordHash = job.secretEnc ? decryptSecret(job.secretEnc, this.key()) : null;

      await this.jobs.step(jobId, step);
      // An interrupted attempt leaves its database and role behind
      await this.manager.evict(tenant.id);
      await this.provisioner.dropOwnDatabase(tenant.id, tenant.dbName, tenant.dbUser);
      await this.control.tenant.update({ where: { id: tenant.id }, data: NO_APP_ROLE });
      await this.provisioner.createDatabase(tenant.id, {
        dbName: tenant.dbName,
        dbUser: tenant.dbUser,
        password: decryptSecret(tenant.dbPasswordEnc, this.key()),
      });
      await this.jobs.step(jobId, step, 'DONE');

      step = 'migrate';
      await this.jobs.step(jobId, step);
      const ownerUrl = this.registry.ownerConnectionString(tenant);
      const schemaVersion = await migrateTenantDatabase(ownerUrl);
      const appRole = await ensureTenantAppRole({
        adminUrl: this.config.getOrThrow<string>('TENANT_DB_ADMIN_URL'),
        ownerUrl,
        tenantId: tenant.id,
        dbName: tenant.dbName,
        dbUser: tenant.dbUser,
        key: this.key(),
        current: NO_APP_ROLE,
      });
      await this.control.tenant.update({ where: { id: tenant.id }, data: appRole });
      await this.jobs.step(jobId, step, 'DONE');

      step = 'seed';
      await this.jobs.step(jobId, step);
      const tenantDb = this.registry.clientFor({ ...tenant, ...appRole });
      await seedTenant(tenantDb, {
        subdomain: tenant.subdomain,
        company: { legalName: input.companyLegalName, countryCode: input.companyCountryCode, currency: input.companyCurrency },
        admin: { email: input.adminEmail, fullName: input.adminFullName, passwordHash },
      });
      await this.jobs.step(jobId, step, 'DONE');

      const firstCompany = await tenantDb.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
      await this.control.tenant.update({
        where: { id: tenant.id },
        data: { status: TenantStatus.ACTIVE, schemaVersion, defaultCompanyId: firstCompany?.id, failureReason: null },
      });
      // May be cached as unavailable, on another instance or in the API when a job activates it
      await this.events.publish({ kind: 'tenant', tenantId: tenant.id, subdomain: tenant.subdomain });
      const active = await this.control.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
      await this.finishActive(jobId, active);
    } catch (error) {
      this.logger.error({ err: error, tenantId: tenant.id, jobId, step }, 'Tenant provisioning failed');
      // failure_reason reaches the API: driver and Prisma messages name databases, roles and hosts, so they stay in the log
      const reason = error instanceof TenantDbNameConflictError ? error.message : 'failed, see the server log';
      await this.cleanup(tenant, jobId, step, reason);
    }
  }

  /** E-TEN-08: the tenant is usable whatever happens here. A failed invitation is recorded and can be sent again. */
  private async finishActive(jobId: string, tenant: Tenant) {
    const input = tenant.provisioningInput as unknown as ProvisioningInput | null;
    const invite = input ? await this.inviteAdmin(jobId, tenant, input.adminEmail) : null;
    await this.control.tenant.update({ where: { id: tenant.id }, data: { provisioningInput: Prisma.DbNull } });
    // Before the job ends: whoever sees it finished finds the tenant's usage in the list. Never throws.
    await this.usage.refresh(tenant);
    await this.jobs.succeed(jobId, invite ? { invite } : undefined);
  }

  private async inviteAdmin(jobId: string, tenant: Tenant, email: string) {
    try {
      const db = this.registry.clientFor(tenant);
      const admin = await db.user.findUnique({ where: { email }, select: { id: true, status: true } });
      if (admin?.status !== UserStatus.INVITED) {
        await this.jobs.step(jobId, 'invite', 'SKIPPED');
        return null;
      }
      await this.jobs.step(jobId, 'invite');
      // E-TEN-07: a redelivery after the invitation went out does not send a second mail
      const pending = await db.invitation.count({
        where: { userId: admin.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      const status =
        pending > 0 ? 'QUEUED' : (await this.registry.runIn(tenant, () => this.invitations.send(admin.id, email, null))).mailStatus;
      await this.jobs.step(jobId, 'invite', 'DONE');
      // Never the link: job results are readable by every platform role. Without mail, resend-invite hands it over.
      return { status };
    } catch (error) {
      this.logger.error({ err: error, tenantId: tenant.id, jobId }, 'Could not invite the first admin');
      await this.jobs.step(jobId, 'invite', 'FAILED');
      return { status: 'FAILED' };
    }
  }

  /** Drops what provisioning this tenant created and marks it FAILED (kept, so it can be retried). */
  private async cleanup(tenant: Tenant, jobId: string, step: Step, reason: string) {
    await this.manager.evict(tenant.id);
    try {
      await this.provisioner.dropOwnDatabase(tenant.id, tenant.dbName, tenant.dbUser);
    } catch (error) {
      this.logger.error({ err: error, tenantId: tenant.id }, 'Could not drop tenant database after failure');
    }
    const failureReason = `${step}: ${reason}`;
    await this.control.tenant.updateMany({
      where: { id: tenant.id, status: TenantStatus.PROVISIONING },
      data: { status: TenantStatus.FAILED, failureReason, ...NO_APP_ROLE },
    });
    await this.jobs.step(jobId, step, 'FAILED');
    await this.jobs.fail(jobId, { failedStep: step, reason });
  }

  /** The control database itself kept failing: the job cannot run, and must not stay active. */
  private async onDeadLetter(message: unknown) {
    const jobId = parseJobMessage(message);
    const job = await this.control.provisioningJob.findUnique({ where: { id: jobId }, select: { tenantId: true } });
    await this.jobs.fail(jobId, { reason: 'failed, see the server log' });
    if (job?.tenantId) {
      await this.control.tenant.updateMany({
        where: { id: job.tenantId, status: TenantStatus.PROVISIONING },
        data: { status: TenantStatus.FAILED, failureReason: 'failed, see the server log' },
      });
    }
  }

  private key() {
    return this.config.getOrThrow<string>('DB_CREDENTIALS_KEY');
  }
}
