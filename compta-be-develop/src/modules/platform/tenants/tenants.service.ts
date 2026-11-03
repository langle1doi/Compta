import { HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encryptSecret } from '../../../common/crypto/secret-box';
import { AppException, fieldError } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ControlEventsService } from '../../../database/control-events.service';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { Prisma, ProvisioningJobStatus, ProvisioningJobType, TenantStatus } from '../../../generated/control/client';
import { UserStatus } from '../../../generated/tenant/enums';
import { hashPassword } from '../../auth/password';
import { TENANT_ADMIN_ROLE_KEY } from '../../rbac/permission-catalog';
import { POSTGRES_IDENTIFIER_MAX, RESERVED_SUBDOMAINS } from '../../tenancy/reserved-subdomains';
import { TenantRegistryService } from '../../tenancy/tenant-registry.service';
import { InvitationsService } from '../../users/invitations.service';
import type { PlatformActor } from '../audit/platform-actor';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { JobsService } from '../jobs/jobs.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQuery } from './dto/list-tenants.query';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { latestTenantSchemaVersion } from './tenant-migrator';
import { TenantProvisionerService } from './tenant-provisioner.service';
import { ProvisioningInput, TenantProvisioningService } from './tenant-provisioning.service';
import { assertTransition } from './tenant-status';
import { TenantUsageService } from './tenant-usage.service';

const DEFAULT_PLAN = 'starter';
const ACTIVE_JOB = [ProvisioningJobStatus.QUEUED, ProvisioningJobStatus.RUNNING];

const subdomainTaken = () =>
  new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.SUBDOMAIN_TAKEN, 'Subdomain already taken', [
    { field: 'subdomain', code: ErrorCode.SUBDOMAIN_TAKEN, message: 'Subdomain already taken' },
  ]);

// Longer than the slowest provisioning (tenant migrations time out after 5 minutes):
// a tenant this old in PROVISIONING can only belong to a process that died.
const PROVISIONING_STALE_MS = 15 * 60 * 1000;
/** F01 BR-06 */
export const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// Never return DB credentials or provisioning input to the client
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  subdomain: true,
  status: true,
  schemaVersion: true,
  failureReason: true,
  plan: { select: { id: true, code: true, name: true } },
  usage: true,
  suspendedAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantSelect;

type PublicTenant = Prisma.TenantGetPayload<{ select: typeof PUBLIC_FIELDS }>;

/** Prisma "contains" passes % and _ through to LIKE. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

function sortBy(sort: ListTenantsQuery['sort'], order: Prisma.SortOrder): Prisma.TenantOrderByWithRelationInput {
  switch (sort) {
    case 'plan':
      return { plan: { name: order } };
    case 'schema_version':
      return { schemaVersion: { sort: order, nulls: 'last' } };
    case 'users':
      return { usage: { users: order } };
    case 'companies':
      return { usage: { companies: order } };
    case 'storage_bytes':
      return { usage: { storageBytes: order } };
    case 'created_at':
      return { createdAt: order };
    default:
      return { [sort]: order };
  }
}

function toPublic({ usage, ...tenant }: PublicTenant, snapshot: PublicTenant['usage'] = usage) {
  const live = tenant.status === TenantStatus.ACTIVE || tenant.status === TenantStatus.SUSPENDED;
  return {
    ...tenant,
    isOutdated: live && tenant.schemaVersion !== latestTenantSchemaVersion(),
    purgeAt: tenant.deletedAt && new Date(tenant.deletedAt.getTime() + PURGE_AFTER_MS),
    usage: snapshot && {
      users: snapshot.users,
      companies: snapshot.companies,
      invoicesThisMonth: snapshot.invoicesThisMonth,
      storageBytes: Number(snapshot.storageBytes),
      databaseBytes: Number(snapshot.databaseBytes),
      filesBytes: Number(snapshot.filesBytes),
      capturedAt: snapshot.capturedAt,
    },
  };
}

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly control: ControlPrismaService,
    private readonly provisioner: TenantProvisionerService,
    private readonly events: ControlEventsService,
    private readonly config: ConfigService,
    private readonly audit: PlatformAuditService,
    private readonly usage: TenantUsageService,
    private readonly jobs: JobsService,
    private readonly provisioning: TenantProvisioningService,
    private readonly registry: TenantRegistryService,
    private readonly invitations: InvitationsService,
  ) {}

  async list(query: ListTenantsQuery) {
    await this.failInterruptedProvisioning();
    const keyword = query.keyword && escapeLike(query.keyword);
    const where: Prisma.TenantWhereInput = {
      status: query.status,
      ...(query.plan && { plan: { code: query.plan } }),
      ...(keyword && {
        OR: [{ name: { contains: keyword, mode: 'insensitive' } }, { subdomain: { contains: keyword, mode: 'insensitive' } }],
      }),
    };
    const [rows, total, byStatus] = await Promise.all([
      this.control.tenant.findMany({
        where,
        select: PUBLIC_FIELDS,
        orderBy: [sortBy(query.sort, query.order), { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.control.tenant.count({ where }),
      // The tabs of the page: totals of the platform, whatever the filters
      this.control.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(Object.values(TenantStatus).map((status) => [status.toLowerCase(), 0]));
    for (const row of byStatus) counts[row.status.toLowerCase()] = row._count._all;
    return { items: rows.map((row) => toPublic(row)), total, page: query.page, pageSize: query.pageSize, counts };
  }

  async get(id: string) {
    await this.failInterruptedProvisioning();
    const row = await this.control.tenant.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Tenant not found');
    const tenant = await this.control.tenant.findUniqueOrThrow({ where: { id }, select: PUBLIC_FIELDS });
    return toPublic(tenant, await this.usage.current(row, tenant.usage));
  }

  /** Commits the tenant and its job; the database is created in the background. `inline` waits for it (seed-control). */
  async create(dto: CreateTenantDto, actor: PlatformActor, { inline = false } = {}) {
    // F01 AC-02: invalid/duplicate subdomain -> 422, no database created
    if (RESERVED_SUBDOMAINS.has(dto.subdomain)) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.SUBDOMAIN_RESERVED, 'Subdomain is reserved', [
        { field: 'subdomain', code: ErrorCode.SUBDOMAIN_RESERVED, message: 'Subdomain is reserved' },
      ]);
    }
    if (await this.control.tenant.findUnique({ where: { subdomain: dto.subdomain } })) throw subdomainTaken();
    const plan = await this.control.plan.findUnique({
      where: dto.planId ? { id: dto.planId } : { code: dto.planCode ?? DEFAULT_PLAN },
    });
    if (!plan) throw fieldError(dto.planId ? 'planId' : 'planCode', 'unknownPlan', 'Unknown plan');

    const creds = this.provisioner.credentialsFor(dto.subdomain);
    // E-TEN-02: refused here, a longer name would be silently truncated by PostgreSQL and could collide
    if (creds.dbName.length > POSTGRES_IDENTIFIER_MAX) throw fieldError('subdomain', 'tooLong', 'Subdomain is too long for this platform');

    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const input: ProvisioningInput = {
      companyLegalName: dto.companyLegalName ?? dto.name,
      companyCountryCode: dto.companyCountryCode,
      companyCurrency: dto.companyCurrency,
      adminEmail,
      adminFullName: dto.adminFullName ?? adminEmail.split('@')[0],
    };
    const secretEnc = await this.jobSecret(dto.adminPassword);
    try {
      const { tenant, job } = await this.control.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.name,
            subdomain: dto.subdomain,
            planId: plan.id,
            status: TenantStatus.PROVISIONING,
            dbName: creds.dbName,
            dbUser: creds.dbUser,
            dbPasswordEnc: this.encrypt(creds.password),
            provisioningInput: input as unknown as Prisma.InputJsonValue,
          },
          select: PUBLIC_FIELDS,
        });
        const job = await tx.provisioningJob.create({
          data: {
            type: ProvisioningJobType.PROVISION,
            tenantId: tenant.id,
            createdBy: actor.adminId,
            secretEnc,
            publishedAt: inline ? new Date() : null,
          },
        });
        await this.audit.record(
          actor,
          { action: 'tenant.create', targetType: 'tenant', targetId: tenant.id, after: { ...tenant, jobId: job.id } },
          tx,
        );
        return { tenant, job };
      });
      return await this.dispatch(tenant, job, inline);
    } catch (error) {
      // E-TEN-03: two requests for the same subdomain; the unique constraint decides, the loser created nothing
      if (isUniqueViolation(error)) throw subdomainTaken();
      throw error;
    }
  }

  /** A process killed while provisioning cannot mark its tenant FAILED: do it here so the tenant can be retried. */
  async failInterruptedProvisioning() {
    const stale = await this.control.tenant.findMany({
      where: { status: TenantStatus.PROVISIONING, updatedAt: { lt: new Date(Date.now() - PROVISIONING_STALE_MS) } },
      select: { id: true, status: true },
    });
    if (stale.length === 0) return;
    const ids = stale.map((t) => t.id);
    const reason = 'interrupted: provisioning did not finish';
    await this.control.$transaction([
      this.control.tenant.updateMany({
        where: { id: { in: ids }, status: TenantStatus.PROVISIONING },
        data: { status: TenantStatus.FAILED, failureReason: reason },
      }),
      this.control.provisioningJob.updateMany({
        where: { tenantId: { in: ids }, type: ProvisioningJobType.PROVISION, status: { in: ACTIVE_JOB } },
        data: { status: ProvisioningJobStatus.FAILED, finishedAt: new Date(), secretEnc: null, result: { reason } },
      }),
    ]);
  }

  /** F01 AC-03: a FAILED tenant can be provisioned again. */
  async retry(id: string, adminPassword: string | undefined, actor: PlatformActor, { inline = false } = {}) {
    await this.failInterruptedProvisioning();
    const tenant = await this.control.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    assertTransition(tenant.status, TenantStatus.PROVISIONING);

    const secretEnc = await this.jobSecret(adminPassword);
    const { row, job } = await this.control
      .$transaction(async (tx) => {
        // Conditional update: of two concurrent retries only one may run, the other would drop its database
        const { count } = await tx.tenant.updateMany({
          where: { id, status: tenant.status },
          data: { status: TenantStatus.PROVISIONING, failureReason: null },
        });
        if (count === 0) assertTransition(TenantStatus.PROVISIONING, TenantStatus.PROVISIONING);
        const job = await tx.provisioningJob.create({
          data: {
            type: ProvisioningJobType.PROVISION,
            tenantId: id,
            createdBy: actor.adminId,
            secretEnc,
            publishedAt: inline ? new Date() : null,
          },
        });
        await this.audit.record(actor, { action: 'tenant.retry', targetType: 'tenant', targetId: id, after: { jobId: job.id } }, tx);
        return { row: await tx.tenant.findUniqueOrThrow({ where: { id }, select: PUBLIC_FIELDS }), job };
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) assertTransition(TenantStatus.PROVISIONING, TenantStatus.PROVISIONING);
        throw error;
      });
    return this.dispatch(row, job, inline);
  }

  /** F01: sends the first admin a new link; the old one stops working. Without mail the link is handed to the caller, once. */
  async resendInvite(id: string, actor: PlatformActor) {
    const tenant = await this.control.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const noPending = () => new AppException(HttpStatus.CONFLICT, ErrorCode.NO_PENDING_INVITE, 'This tenant has no pending invitation');
    if (tenant.status !== TenantStatus.ACTIVE) throw noPending();
    const sent = await this.registry.runIn(tenant, async () => {
      const invited = await this.registry.clientFor(tenant).user.findFirst({
        where: { status: UserStatus.INVITED, memberships: { some: { companyId: null, role: { key: TENANT_ADMIN_ROLE_KEY } } } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true },
      });
      if (!invited) throw noPending();
      return this.invitations.send(invited.id, invited.email, null);
    });
    await this.audit.record(actor, {
      action: 'tenant.resend_invite',
      targetType: 'tenant',
      targetId: id,
      after: { mailStatus: sent.mailStatus },
    });
    return sent;
  }

  private async dispatch(tenant: PublicTenant, job: { id: string; type: ProvisioningJobType }, inline: boolean) {
    if (inline) await this.provisioning.run(job.id);
    else await this.jobs.publish(job);
    return { tenant: toPublic(tenant), jobId: job.id };
  }

  /** The job needs the password hash for as long as it can run again; encrypted, and erased when it ends. */
  private async jobSecret(adminPassword: string | undefined) {
    return adminPassword ? this.encrypt(await hashPassword(adminPassword)) : null;
  }

  async setStatus(id: string, dto: UpdateTenantStatusDto, actor: PlatformActor) {
    const tenant = await this.control.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    // PROVISIONING -> ACTIVE belongs to provisioning alone: a tenant without its database cannot be switched on by hand
    if (tenant.status === TenantStatus.PROVISIONING) assertTransition(TenantStatus.PROVISIONING, TenantStatus.PROVISIONING);
    assertTransition(tenant.status, dto.status);
    if (dto.status !== TenantStatus.ACTIVE && dto.confirmName !== tenant.name) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.CONFIRM_NAME_MISMATCH, 'Type the exact tenant name to confirm', [
        { field: 'confirm_name', code: ErrorCode.CONFIRM_NAME_MISMATCH, message: 'Type the exact tenant name to confirm' },
      ]);
    }

    const now = new Date();
    const updated = await this.control.$transaction(async (tx) => {
      // E-TEN-09: of two concurrent changes only the first still finds the status it read
      const { count } = await tx.tenant.updateMany({
        where: { id, status: tenant.status },
        data: {
          status: dto.status,
          suspendedAt: dto.status === TenantStatus.SUSPENDED ? now : dto.status === TenantStatus.ACTIVE ? null : undefined,
          // F01 BR-06: access is blocked now; the purge job drops DB and files after 30 days
          deletedAt: dto.status === TenantStatus.DELETED ? now : undefined,
        },
      });
      if (count === 0) assertTransition(dto.status, dto.status);
      await this.audit.record(
        actor,
        {
          action: 'tenant.status',
          targetType: 'tenant',
          targetId: id,
          before: { status: tenant.status },
          after: { status: dto.status, reason: dto.reason },
        },
        tx,
      );
      return tx.tenant.findUniqueOrThrow({ where: { id }, select: PUBLIC_FIELDS });
    });
    this.logger.log({ tenantId: id, from: tenant.status, to: dto.status, reason: dto.reason }, 'Tenant status changed');
    // Drops the cached tenant lookup and connection pool on every instance
    await this.events.publish({ kind: 'tenant', tenantId: id, subdomain: tenant.subdomain });
    return toPublic(updated);
  }

  /** Applies at once. Going below current usage is allowed: old data stays readable, creating more is refused (E-TEN-12). */
  async changePlan(id: string, planId: string, actor: PlatformActor) {
    const plan = await this.control.plan.findUnique({ where: { id: planId } });
    if (!plan) throw fieldError('planId', 'unknownPlan', 'Unknown plan');
    const tenant = await this.control.tenant.findUnique({ where: { id }, include: { plan: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.status === TenantStatus.DELETED) assertTransition(tenant.status, tenant.status);

    const updated = await this.control.$transaction(async (tx) => {
      const row = await tx.tenant.update({ where: { id }, data: { planId }, select: PUBLIC_FIELDS });
      await this.audit.record(
        actor,
        { action: 'tenant.plan', targetType: 'tenant', targetId: id, before: { plan: tenant.plan.code }, after: { plan: plan.code } },
        tx,
      );
      return row;
    });
    await this.events.publish({ kind: 'tenant', tenantId: id, subdomain: tenant.subdomain });

    const usage = updated.usage;
    const overLimits = [
      ...(usage && usage.users > plan.maxUsers ? ['users'] : []),
      ...(usage && usage.companies > plan.maxCompanies ? ['companies'] : []),
      ...(usage && Number(usage.storageBytes) > plan.maxStorageGb * 1024 ** 3 ? ['storage'] : []),
    ];
    return { ...toPublic(updated), overLimits };
  }

  private encrypt(password: string) {
    return encryptSecret(password, this.config.getOrThrow('DB_CREDENTIALS_KEY'));
  }
}
