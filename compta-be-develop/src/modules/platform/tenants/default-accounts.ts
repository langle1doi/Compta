import type { PrismaClient as ControlPrismaClient } from '../../../generated/control/client';
import { Prisma } from '../../../generated/tenant/client';
import { UserStatus } from '../../../generated/tenant/enums';
import type { TenantPrismaClient } from '../../../database/tenant-prisma.manager';
import { hashPassword } from '../../auth/password';
import { TENANT_ADMIN_ROLE_KEY } from '../../rbac/permission-catalog';
import { PLATFORM_SUPER_ADMIN } from '../../rbac/platform-catalog';

/**
 * One default account per role, created in every environment (product owner decision, overrides F02 BR-01).
 * Created only when missing: an existing account is never overwritten, re-passworded or re-assigned.
 * The API warns at startup while any of them still uses the default password.
 */
export const DEFAULT_PASSWORD = '123456';
export const SUPER_ADMIN_EMAIL = 'superadmin@platform.local';

/** Tenant created on a brand-new platform (no tenant yet). */
export const DEFAULT_TENANT = {
  name: 'Groupe DFM',
  subdomain: 'dfm',
  planCode: 'business',
  companyLegalName: 'DFM-EUROPE',
};

export interface DefaultTenantAccount {
  email: string;
  fullName: string;
  roleKey: string;
  /** true = membership on every company (company_id NULL); false = first company of the tenant */
  tenantWide: boolean;
}

export const defaultTenantAccounts = (subdomain: string): DefaultTenantAccount[] => [
  { email: `admin@${subdomain}.local`, fullName: 'Admin tenant', roleKey: TENANT_ADMIN_ROLE_KEY, tenantWide: true },
  { email: `owner@${subdomain}.local`, fullName: 'Chủ doanh nghiệp', roleKey: 'owner', tenantWide: false },
  { email: `accountant@${subdomain}.local`, fullName: 'Kế toán', roleKey: 'accountant', tenantWide: false },
  { email: `sales@${subdomain}.local`, fullName: 'Sale', roleKey: 'sales', tenantWide: false },
  { email: `viewer@${subdomain}.local`, fullName: 'Người xem', roleKey: 'viewer', tenantWide: false },
];

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** Creates the missing default accounts of a tenant; returns the emails created. Idempotent. */
export async function ensureDefaultTenantAccounts(db: TenantPrismaClient, subdomain: string): Promise<string[]> {
  const accounts = defaultTenantAccounts(subdomain);
  const existing = await db.user.findMany({ where: { email: { in: accounts.map((a) => a.email) } }, select: { email: true } });
  const missing = accounts.filter((a) => !existing.some((u) => u.email === a.email));
  if (missing.length === 0) return [];

  const [firstCompany, roles, passwordHash] = await Promise.all([
    db.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
    db.role.findMany({ where: { key: { in: missing.map((a) => a.roleKey) } }, select: { id: true, key: true } }),
    hashPassword(DEFAULT_PASSWORD),
  ]);

  const created: string[] = [];
  for (const account of missing) {
    const roleId = roles.find((r) => r.key === account.roleKey)?.id;
    const companyId = account.tenantWide ? null : firstCompany?.id;
    if (!roleId || companyId === undefined) continue;
    try {
      await db.user.create({
        data: {
          email: account.email,
          fullName: account.fullName,
          passwordHash,
          status: UserStatus.ACTIVE,
          memberships: { create: { companyId, roleId } },
        },
      });
      created.push(account.email);
    } catch (error) {
      // Created concurrently by another run: keep theirs
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return created;
}

/** Creates the default Super Admin if missing; returns true when created. Idempotent. */
export async function ensureDefaultSuperAdmin(control: ControlPrismaClient): Promise<boolean> {
  if (await control.platformAdmin.findUnique({ where: { email: SUPER_ADMIN_EMAIL }, select: { id: true } })) return false;
  try {
    const role = await control.platformRole.findUniqueOrThrow({ where: { key: PLATFORM_SUPER_ADMIN }, select: { id: true } });
    await control.platformAdmin.create({
      data: { email: SUPER_ADMIN_EMAIL, fullName: 'Super Admin', passwordHash: await hashPassword(DEFAULT_PASSWORD), roleId: role.id },
    });
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') return false;
    throw error;
  }
}
