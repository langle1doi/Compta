import type { ConfigService } from '@nestjs/config';
import type { ControlEventsService } from '../../../database/control-events.service';
import type { ControlPrismaService } from '../../../database/control-prisma.service';
import type { Tenant } from '../../../generated/control/client';
import { syncRbacCatalog } from '../../rbac/role-grants';
import { ensureTenantAppRole } from '../../tenancy/tenant-app-role';
import type { TenantRegistryService } from '../../tenancy/tenant-registry.service';
import { ensureDefaultTenantAccounts } from '../tenants/default-accounts';
import { migrateTenantDatabase } from '../tenants/tenant-migrator';

export interface TenantMigrationDeps {
  control: ControlPrismaService;
  registry: TenantRegistryService;
  events: ControlEventsService;
  config: ConfigService;
}

/**
 * Pending tenant-schema migrations (as the owner role), application role, RBAC catalog, missing default accounts, then the
 * recorded version: schema_version only moves once all of it worked (E-MIG-04). Safe to run again.
 */
export async function migrateOneTenant({ control, registry, events, config }: TenantMigrationDeps, tenant: Tenant) {
  const ownerUrl = registry.ownerConnectionString(tenant);
  const schemaVersion = await migrateTenantDatabase(ownerUrl);
  const appRole = await ensureTenantAppRole({
    adminUrl: config.getOrThrow<string>('TENANT_DB_ADMIN_URL'),
    ownerUrl,
    tenantId: tenant.id,
    dbName: tenant.dbName,
    dbUser: tenant.dbUser,
    key: config.getOrThrow<string>('DB_CREDENTIALS_KEY'),
    current: tenant,
  });
  await control.tenant.update({ where: { id: tenant.id }, data: appRole });
  const db = registry.clientFor({ ...tenant, ...appRole });
  await db.$transaction((tx) => syncRbacCatalog(tx));
  const createdAccounts = await ensureDefaultTenantAccounts(db, tenant.subdomain);
  const defaultCompany = tenant.defaultCompanyId
    ? null
    : await db.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  await control.tenant.update({
    where: { id: tenant.id },
    data: { schemaVersion, ...(defaultCompany && { defaultCompanyId: defaultCompany.id }) },
  });
  await events.publish({ kind: 'policy', tenantId: tenant.id });
  await events.publish({ kind: 'tenant', tenantId: tenant.id, subdomain: tenant.subdomain });
  return { schemaVersion, createdAccounts };
}
