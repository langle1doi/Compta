import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { ControlEventsService } from '../../database/control-events.service';
import { ControlPrismaService } from '../../database/control-prisma.service';
import { Plan } from '../../generated/control/client';
import { CompanyStatus, DocumentStatus, UserStatus } from '../../generated/tenant/enums';
import { StorageService } from '../storage/storage.service';
import { TenantDbService } from './tenant-db.service';

const CACHE_TTL_MS = 60_000;
export type LimitedResource = 'users' | 'companies' | 'invoices' | 'aiCalls' | 'storageBytes';

const planLimit = (plan: Plan, resource: LimitedResource): number =>
  ({
    users: plan.maxUsers,
    companies: plan.maxCompanies,
    invoices: plan.maxInvoicesMonthly,
    aiCalls: plan.maxAiCallsMonthly,
    storageBytes: plan.maxStorageGb * 1024 ** 3,
  })[resource];

/** Pure rule, shared by every limit. Data already there stays readable: only adding more is refused (F01 AC-05). */
export function assertWithinPlan(plan: Plan, resource: LimitedResource, used: number, adding = 1) {
  const max = planLimit(plan, resource);
  if (used + adding > max) {
    throw new AppException(
      HttpStatus.PAYMENT_REQUIRED,
      ErrorCode.PLAN_LIMIT_REACHED,
      `Plan "${plan.name}" allows ${max} ${resource}; upgrade the plan to add more`,
    );
  }
}

/** F01 BR-04: plan limits checked in the backend before creating limited resources. */
@Injectable()
export class PlanLimitsService {
  private readonly plans = new Map<string, { plan: Plan; expiresAt: number }>();

  constructor(
    private readonly control: ControlPrismaService,
    private readonly tenantDb: TenantDbService,
    private readonly storage: StorageService,
    events: ControlEventsService,
  ) {
    // A change of plan or of its limits applies immediately (US-02)
    events.subscribe((event) => {
      if (event.kind === 'tenant' || event.kind === 'plan') this.plans.clear();
    });
  }

  /** Throws 402 PLAN_LIMIT_REACHED if creating `adding` more would exceed the tenant's plan. */
  async assertCanAdd(resource: 'users' | 'companies' | 'invoices', adding = 1) {
    assertWithinPlan(await this.plan(this.tenantDb.context.planId), resource, await this.used(resource), adding);
  }

  /** E-INV-03: an invited user already holds a seat; a downgrade since the invitation can leave the tenant above its limit. */
  async assertUsersWithinPlan() {
    assertWithinPlan(await this.plan(this.tenantDb.context.planId), 'users', await this.used('users'), 0);
  }

  /** For the AI module: `used` is its monthly call counter. The module does not exist yet, nothing calls this. */
  async assertAiCallAllowed(usedThisMonth: number) {
    assertWithinPlan(await this.plan(this.tenantDb.context.planId), 'aiCalls', usedThisMonth);
  }

  /**
   * F01 BR-04: call before storing a tenant file. The limit covers what the usage page shows: database + files.
   * Nothing stores tenant files yet besides exports, which do not count.
   */
  async assertStorageFits(addingBytes: number) {
    const { tenantId, planId, db } = this.tenantDb.context;
    const [{ size }] = await db.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
    const used = Number(size) + (await this.storage.tenantUsage(tenantId));
    assertWithinPlan(await this.plan(planId), 'storageBytes', used, addingBytes);
  }

  async plan(planId: string): Promise<Plan> {
    const cached = this.plans.get(planId);
    if (cached && cached.expiresAt > Date.now()) return cached.plan;
    const plan = await this.control.plan.findUniqueOrThrow({ where: { id: planId } });
    this.plans.set(planId, { plan, expiresAt: Date.now() + CACHE_TTL_MS });
    return plan;
  }

  private used(resource: 'users' | 'companies' | 'invoices'): Promise<number> {
    const db = this.tenantDb.client;
    if (resource === 'users') return db.user.count({ where: { status: { not: UserStatus.DISABLED } } });
    if (resource === 'companies') return db.company.count({ where: { status: CompanyStatus.ACTIVE } });
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    return db.invoice.count({ where: { status: DocumentStatus.VALIDATED, issueDate: { gte: monthStart } } });
  }
}
