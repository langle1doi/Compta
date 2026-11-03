/**
 * Seeds the control plane. Idempotent; safe on every deploy:
 *  - plans (created only if missing: their limits belong to the Super Admin afterwards),
 *  - platform roles and permissions (kept equal to the code catalog),
 *  - default Super Admin superadmin@platform.local (created only if missing),
 *  - on a brand-new platform (no tenant at all): the default tenant "dfm" with its 5 default accounts,
 *  - a default tenant left FAILED by an earlier run is provisioned again. The job fails if it stays unusable.
 * Usage: npm run db:control:seed   (container: node dist/cli/seed-control.js)
 */
import { Logger } from '@nestjs/common';
import { ControlPrismaService } from '../database/control-prisma.service';
import { ProvisioningJobStatus, TenantStatus } from '../generated/control/enums';
import { SYSTEM_ACTOR } from '../modules/platform/audit/platform-actor';
import {
  DEFAULT_PASSWORD,
  DEFAULT_TENANT,
  defaultTenantAccounts,
  ensureDefaultSuperAdmin,
} from '../modules/platform/tenants/default-accounts';
import { TenantsService } from '../modules/platform/tenants/tenants.service';
import { PlatformEnforcerService, syncPlatformCatalog } from '../modules/rbac/platform-enforcer.service';
import { runCli, withAppContext } from './cli-context';

// Seed accounts count against the limits: starter leaves room for the requested admin + 5 defaults + 4 users.
export const PLANS = [
  { code: 'starter', name: 'Starter', maxUsers: 10, maxCompanies: 1, maxInvoicesMonthly: 200, maxAiCallsMonthly: 500, maxStorageGb: 10 },
  {
    code: 'business',
    name: 'Business',
    maxUsers: 50,
    maxCompanies: 10,
    maxInvoicesMonthly: 5000,
    maxAiCallsMonthly: 10000,
    maxStorageGb: 100,
  },
];

export interface SeedControlResult {
  superAdminCreated: boolean;
  defaultTenantCreated: boolean;
  defaultTenantRepaired: boolean;
}

/** The job records a failure instead of throwing: the deployment must still fail. */
async function assertSucceeded(control: ControlPrismaService, jobId: string) {
  const job = await control.provisioningJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status !== ProvisioningJobStatus.SUCCEEDED)
    throw new Error(`Provisioning of the default tenant failed: ${JSON.stringify(job.result)}`);
}

export function seedControl(): Promise<SeedControlResult> {
  return withAppContext(async (app) => {
    const logger = new Logger('SeedControl');
    const control = app.get(ControlPrismaService);

    for (const plan of PLANS) await control.plan.upsert({ where: { code: plan.code }, create: plan, update: {} });

    await control.$transaction((tx) => syncPlatformCatalog(tx));
    await app.get(PlatformEnforcerService).policyChanged();

    const superAdminCreated = await ensureDefaultSuperAdmin(control);
    if (superAdminCreated) logger.warn('Created default Super Admin superadmin@platform.local (default password)');

    const tenants = app.get(TenantsService);
    await tenants.failInterruptedProvisioning();

    let defaultTenantCreated = false;
    let defaultTenantRepaired = false;
    if ((await control.tenant.count()) === 0) {
      const [admin] = defaultTenantAccounts(DEFAULT_TENANT.subdomain);
      const { jobId } = await tenants.create(
        { ...DEFAULT_TENANT, adminEmail: admin.email, adminFullName: admin.fullName, adminPassword: DEFAULT_PASSWORD },
        SYSTEM_ACTOR,
        { inline: true },
      );
      await assertSucceeded(control, jobId);
      defaultTenantCreated = true;
      logger.warn(`Created default tenant "${DEFAULT_TENANT.subdomain}" with its default accounts (default password)`);
    } else {
      const existing = await control.tenant.findUnique({ where: { subdomain: DEFAULT_TENANT.subdomain } });
      if (existing?.status === TenantStatus.PROVISIONING) {
        throw new Error(`Default tenant "${DEFAULT_TENANT.subdomain}" is still provisioning`);
      }
      if (existing?.status === TenantStatus.FAILED) {
        const { jobId } = await tenants.retry(existing.id, DEFAULT_PASSWORD, SYSTEM_ACTOR, { inline: true });
        await assertSucceeded(control, jobId);
        defaultTenantRepaired = true;
        logger.warn(`Provisioned default tenant "${DEFAULT_TENANT.subdomain}" again after a failed run`);
      }
    }
    return { superAdminCreated, defaultTenantCreated, defaultTenantRepaired };
  });
}

if (require.main === module) runCli(seedControl);
