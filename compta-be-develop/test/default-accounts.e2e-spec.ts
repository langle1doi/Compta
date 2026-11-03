import { NestExpressApplication } from '@nestjs/platform-express';
import { migrateTenants } from '../src/cli/migrate-tenants';
import { seedControl } from '../src/cli/seed-control';
import { hashPassword } from '../src/modules/auth/password';
import {
  DEFAULT_PASSWORD,
  DEFAULT_TENANT,
  defaultTenantAccounts,
  SUPER_ADMIN_EMAIL,
} from '../src/modules/platform/tenants/default-accounts';
import { EnforcerService } from '../src/modules/rbac/enforcer.service';
import { PERMISSIONS } from '../src/modules/rbac/permission-catalog';
import { TenantRegistryService } from '../src/modules/tenancy/tenant-registry.service';
import { PRD_PERMISSION_MATRIX } from './fixtures/prd-permission-matrix';
import { Api, billingAddress, createTestApp, hostOf, uniqueSubdomain } from './support/app';
import { withControl, withTenantDb } from './support/db';

const DFM = DEFAULT_TENANT.subdomain;
const host = hostOf(DFM);

/** Global setup seeded a brand-new platform: Super Admin + tenant "dfm" with its 5 default accounts. */
describe('Default accounts (one per role, password 123456)', () => {
  let app: NestExpressApplication;
  let api: Api;
  let company: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
  });
  afterAll(() => app.close());

  it('fresh platform: the Super Admin and the 5 accounts of tenant dfm log in with 123456', async () => {
    tokens.superadmin = await api.platformToken(SUPER_ADMIN_EMAIL, DEFAULT_PASSWORD);
    // Other test files add e2e* tenants; the seed created only "dfm", the very first one
    const list = await api.call('get', '/platform/api/v1/tenants?sort=created_at&order=asc&page_size=100', { token: tokens.superadmin });
    const tenants = list.body.items as { subdomain: string }[];
    expect(tenants[0]).toEqual(
      expect.objectContaining({ subdomain: DFM, status: 'ACTIVE', plan: expect.objectContaining({ code: 'business' }) }),
    );
    expect(tenants.filter((t) => !t.subdomain.startsWith('e2e'))).toHaveLength(1);

    for (const account of defaultTenantAccounts(DFM)) tokens[account.roleKey] = await api.login(DFM, account.email, DEFAULT_PASSWORD);
    const companies = (await api.call('get', '/api/v1/companies', { host, token: tokens.tenant_admin })).body;
    expect(companies.map((c: { legal_name: string }) => c.legal_name)).toEqual([DEFAULT_TENANT.companyLegalName]);
    company = companies[0].id;
  });

  it('accounts are ACTIVE, with the expected membership (admin tenant-wide, others on the first company)', async () => {
    const users = (await api.call('get', '/api/v1/users', { host, token: tokens.tenant_admin })).body as {
      email: string;
      status: string;
      memberships: { company_id: string | null; role: { key: string } }[];
    }[];
    for (const account of defaultTenantAccounts(DFM)) {
      const user = users.find((u) => u.email === account.email)!;
      expect(user.status).toBe('ACTIVE');
      expect(user.memberships).toEqual([
        { company_id: account.tenantWide ? null : company, role: expect.objectContaining({ key: account.roleKey }) },
      ]);
    }
  });

  it('each account has exactly the PRD §1.8 permissions, through Casbin and the real policy tables', async () => {
    const enforcers = app.get(EnforcerService);
    const tenant = (await app.get(TenantRegistryService).findBySubdomain(DFM))!;
    const db = app.get(TenantRegistryService).clientFor(tenant);
    const enforcer = await enforcers.forTenant(tenant.id, db);

    const mismatches: string[] = [];
    for (const account of defaultTenantAccounts(DFM)) {
      const user = (await db.user.findUniqueOrThrow({ where: { email: account.email } })).id;
      for (const { resource, action } of PERMISSIONS) {
        const code = `${resource}.${action}`;
        const expected = PRD_PERMISSION_MATRIX[account.roleKey][code] ?? null;
        const actual = await enforcers.resolveScope(enforcer, user, company, resource, action);
        if (actual !== expected) mismatches.push(`${account.email} ${code}: expected ${expected}, got ${actual}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('GET /auth/me shows, for each account, exactly what Casbin enforces and what the PRD matrix says', async () => {
    const registry = app.get(TenantRegistryService);
    const enforcers = app.get(EnforcerService);
    const tenant = (await registry.findBySubdomain(DFM))!;
    const enforcer = await enforcers.forTenant(tenant.id, registry.clientFor(tenant));

    const mismatches: string[] = [];
    for (const account of defaultTenantAccounts(DFM)) {
      const res = await api.call('get', '/api/v1/auth/me', { host, token: tokens[account.roleKey] });
      expect(res.status).toBe(200);
      expect(res.body.memberships).toHaveLength(1);
      const [membership] = res.body.memberships as {
        company: { id: string } | null;
        permissions: { resource: string; action: string; scope: string }[];
      }[];
      expect(membership.company?.id ?? null).toBe(account.tenantWide ? null : company);

      const shown = new Map(membership.permissions.map((p) => [`${p.resource}.${p.action}`, p.scope]));
      for (const { resource, action } of PERMISSIONS) {
        const code = `${resource}.${action}`;
        const casbin = await enforcers.resolveScope(enforcer, res.body.id, company, resource, action);
        const inMe = shown.get(code) ?? null;
        const inMatrix = PRD_PERMISSION_MATRIX[account.roleKey][code] ?? null;
        if (inMe !== casbin || inMe !== inMatrix)
          mismatches.push(`${account.email} ${code}: me=${inMe} casbin=${casbin} matrix=${inMatrix}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('HTTP spot checks per role', async () => {
    const as = (role: string, method: Parameters<Api['call']>[0], path: string, body?: object) =>
      api.call(method, path, { host, token: tokens[role], company, body }).then((r) => r.status);
    const customer = { type: 'COMPANY', name: 'Default accounts test', addresses: [billingAddress] };

    expect(await as('tenant_admin', 'get', '/api/v1/users')).toBe(200);
    expect(await as('tenant_admin', 'get', '/api/v1/roles')).toBe(200);
    expect(await as('owner', 'get', '/api/v1/customers')).toBe(200);
    expect(await as('owner', 'get', '/api/v1/users')).toBe(403);
    expect(await as('accountant', 'get', '/api/v1/customers')).toBe(200);
    expect(await as('accountant', 'post', '/api/v1/customers', customer)).toBe(403);
    expect(await as('sales', 'post', '/api/v1/customers', customer)).toBe(201);
    expect(await as('sales', 'get', '/api/v1/roles')).toBe(403);
    expect(await as('viewer', 'get', `/api/v1/companies/${company}/tax-rates`)).toBe(200);
    expect(await as('viewer', 'post', '/api/v1/customers', customer)).toBe(403);
  });

  it('a newly provisioned tenant also gets its 5 default accounts, counted in the plan', async () => {
    const sub = uniqueSubdomain('defacc');
    await api.createTenant(tokens.superadmin, sub);
    for (const account of defaultTenantAccounts(sub)) await expect(api.login(sub, account.email, DEFAULT_PASSWORD)).resolves.toBeTruthy();
    const count = await withTenantDb(sub, async (db) =>
      Number((await db.query(`SELECT count(*) FROM users WHERE status = 'ACTIVE'`)).rows[0].count),
    );
    expect(count).toBe(6); // requested admin + 5 defaults
  });

  describe('re-running seed and migrations', () => {
    const owner = `owner@${DFM}.local`;
    const sales = `sales@${DFM}.local`;
    const viewer = `viewer@${DFM}.local`;
    const NEW_PASSWORD = 'Changed-Password-2026';

    const counts = () =>
      Promise.all([
        withControl(async (c) => (await c.query('SELECT count(*)::int AS n FROM tenants')).rows[0].n),
        withControl(
          async (c) => (await c.query('SELECT count(*)::int AS n FROM platform_admins WHERE email = $1', [SUPER_ADMIN_EMAIL])).rows[0].n,
        ),
      ]);

    it('creates nothing twice, never resets a changed password or role, and re-creates a deleted default account', async () => {
      const [tenantsBefore] = await counts();
      await withTenantDb(DFM, async (db) => {
        await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [await hashPassword(NEW_PASSWORD), owner]);
        await db.query(
          `UPDATE memberships SET role_id = (SELECT id FROM roles WHERE key = 'viewer') WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
          [sales],
        );
        await db.query('DELETE FROM users WHERE email = $1', [viewer]);
      });
      const usersBefore = await withTenantDb(DFM, async (db) => Number((await db.query('SELECT count(*) FROM users')).rows[0].count));

      // Twice, as a deploy pipeline would
      for (let i = 0; i < 2; i++) {
        await expect(seedControl()).resolves.toEqual({
          superAdminCreated: false,
          defaultTenantCreated: false,
          defaultTenantRepaired: false,
        });
        await expect(migrateTenants(DFM)).resolves.toEqual({ migrated: [DFM], failed: [] });
      }

      expect(await counts()).toEqual([tenantsBefore, 1]);
      const usersAfter = await withTenantDb(DFM, async (db) => Number((await db.query('SELECT count(*) FROM users')).rows[0].count));
      expect(usersAfter).toBe(usersBefore + 1); // only the deleted viewer came back

      // Changed password kept
      const bad = await api.call('post', '/api/v1/auth/login', { host, body: { email: owner, password: DEFAULT_PASSWORD } });
      expect(bad.status).toBe(401);
      await expect(api.login(DFM, owner, NEW_PASSWORD)).resolves.toBeTruthy();
      // Changed role kept
      const role = await withTenantDb(DFM, async (db) =>
        db.query('SELECT r.key FROM memberships m JOIN roles r ON r.id = m.role_id JOIN users u ON u.id = m.user_id WHERE u.email = $1', [
          sales,
        ]),
      );
      expect(role.rows).toEqual([{ key: 'viewer' }]);
      // Deleted default account re-created with the default password
      await expect(api.login(DFM, viewer, DEFAULT_PASSWORD)).resolves.toBeTruthy();
    });

    it('a default tenant left FAILED is provisioned again, and the job fails while it stays unusable', async () => {
      const dbName = await withControl(
        async (c) => (await c.query('SELECT db_name FROM tenants WHERE subdomain = $1', [DFM])).rows[0].db_name,
      );
      const markFailed = (name: string) =>
        withControl((c) =>
          c.query(`UPDATE tenants SET status = 'FAILED', db_name = $1, provisioning_input = $2 WHERE subdomain = $3`, [
            name,
            JSON.stringify({
              companyLegalName: DEFAULT_TENANT.companyLegalName,
              adminEmail: `admin@${DFM}.local`,
              adminFullName: 'Admin tenant',
            }),
            DFM,
          ]),
        );
      const status = () =>
        withControl(async (c) => (await c.query('SELECT status FROM tenants WHERE subdomain = $1', [DFM])).rows[0].status);

      // An invalid database name makes provisioning fail again
      await markFailed('BAD-NAME');
      await expect(seedControl()).rejects.toThrow();
      expect(await status()).toBe('FAILED');

      await markFailed(dbName);
      await expect(seedControl()).resolves.toMatchObject({ defaultTenantRepaired: true });
      expect(await status()).toBe('ACTIVE');
      await expect(migrateTenants(DFM)).resolves.toEqual({ migrated: [DFM], failed: [] });
      const { rows } = await withTenantDb(DFM, (db) => db.query('SELECT email FROM users ORDER BY email'));
      expect(rows.map((u: { email: string }) => u.email)).toEqual(expect.arrayContaining(defaultTenantAccounts(DFM).map((a) => a.email)));
    });
  });
});
