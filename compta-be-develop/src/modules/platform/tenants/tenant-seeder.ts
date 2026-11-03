import type { TenantPrismaClient } from '../../../database/tenant-prisma.manager';
import { UserStatus } from '../../../generated/tenant/enums';
import { seedDefaultTaxRates } from '../../companies/default-tax-rates';
import { TENANT_ADMIN_ROLE_KEY } from '../../rbac/permission-catalog';
import { syncRbacCatalog } from '../../rbac/role-grants';
import { ensureDefaultTenantAccounts } from './default-accounts';

export interface TenantSeedInput {
  subdomain: string;
  company: { legalName: string; countryCode?: string; currency?: string };
  /** No password: the admin is INVITED and sets one through the invitation */
  admin: { email: string; fullName: string; passwordHash: string | null };
}

/** Default data for a freshly migrated tenant DB (roles, first company, admins, default accounts). Safe to re-run. */
export async function seedTenant(db: TenantPrismaClient, input: TenantSeedInput) {
  await db.$transaction(async (tx) => {
    await syncRbacCatalog(tx);

    if ((await tx.company.count()) === 0) {
      const countryCode = input.company.countryCode ?? 'FR';
      const company = await tx.company.create({
        data: { legalName: input.company.legalName, countryCode, currency: input.company.currency ?? 'EUR' },
      });
      await seedDefaultTaxRates(tx, company.id, countryCode);
    }

    const adminRole = await tx.role.findUniqueOrThrow({ where: { key: TENANT_ADMIN_ROLE_KEY } });
    const admin = await tx.user.upsert({
      where: { email: input.admin.email },
      create: {
        email: input.admin.email,
        fullName: input.admin.fullName,
        passwordHash: input.admin.passwordHash,
        status: input.admin.passwordHash ? UserStatus.ACTIVE : UserStatus.INVITED,
      },
      update: {},
    });
    const tenantWide = await tx.membership.findFirst({ where: { userId: admin.id, companyId: null } });
    if (!tenantWide) await tx.membership.create({ data: { userId: admin.id, companyId: null, roleId: adminRole.id } });
  });
  await ensureDefaultTenantAccounts(db, input.subdomain);
}
