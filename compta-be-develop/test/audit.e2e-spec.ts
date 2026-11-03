import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { decryptSecret } from '../src/common/crypto/secret-box';
import { migrateTenants } from '../src/cli/migrate-tenants';
import { billingAddress, uniqueSubdomain, USER_PASSWORD } from './support/app';
import { tenantCredentials, withAdmin, withControl } from './support/db';
import { TenantFixture } from './support/tenant-fixture';

const NEW_PASSWORD = 'Audit-New-Password-2026';

describe('F16 audit', () => {
  const fx = new TenantFixture(uniqueSubdomain('audit'));
  let call: TenantFixture['call'];

  const appRoleUrl = async () => {
    const { rows } = await withControl((c) =>
      c.query('SELECT db_app_user, db_app_password_enc FROM tenants WHERE subdomain = $1', [fx.sub]),
    );
    const creds = await tenantCredentials(fx.sub);
    const password = decryptSecret(rows[0].db_app_password_enc, process.env.DB_CREDENTIALS_KEY!);
    return {
      user: rows[0].db_app_user as string,
      url: `postgresql://${rows[0].db_app_user}:${encodeURIComponent(password)}@${creds.host}:${creds.port}/${creds.dbName}`,
    };
  };
  const asAppRole = async <T>(fn: (c: Client) => Promise<T>) => {
    const client = new Client({ connectionString: (await appRoleUrl()).url });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  };
  const newCustomer = (name: string, token = fx.admin, company = fx.companyA) =>
    call('post', '/api/v1/customers', { token, company, body: { type: 'COMPANY', name, addresses: [billingAddress] } });

  beforeAll(async () => {
    await fx.start();
    call = fx.call.bind(fx);
  });
  afterAll(() => fx.stop());

  it('BE-F16-01 create, update, status and delete of a customer, and a user change, leave who, what, before, after, IP, time, request id', async () => {
    const headers = { 'User-Agent': 'audit-e2e/1.0', 'X-Request-Id': 'audit-e2e-request-1' };
    const created = await call('post', '/api/v1/customers', {
      token: fx.admin,
      company: fx.companyA,
      headers,
      body: { type: 'COMPANY', name: 'Audited', addresses: [billingAddress] },
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    await call('patch', `/api/v1/customers/${id}`, { token: fx.admin, company: fx.companyA, body: { name: 'Audited 2' } });
    await call('patch', `/api/v1/customers/${id}/status`, { token: fx.admin, company: fx.companyA, body: { status: 'ARCHIVED' } });
    await call('delete', `/api/v1/customers/${id}`, { token: fx.admin, company: fx.companyA });

    const rows = await fx.sql<{
      action: string;
      user_id: string;
      before: { name?: string } | null;
      after: { name?: string } | null;
      ip: string;
      user_agent: string;
      request_id: string;
      created_at: Date;
      company_id: string;
    }>(`SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_at`, [id]);
    expect(rows.map((r) => r.action)).toEqual(['customer.create', 'customer.update', 'customer.status', 'customer.delete']);
    const [create, update] = rows;
    expect(create.user_id).toBeTruthy();
    expect(create.company_id).toBe(fx.companyA);
    expect(create.ip).toBeTruthy();
    expect(create.user_agent).toBe('audit-e2e/1.0');
    expect(create.request_id).toBe('audit-e2e-request-1');
    expect(create.created_at).toBeInstanceOf(Date);
    expect(create.before).toBeNull();
    expect(create.after?.name).toBe('Audited');
    expect(update.before?.name).toBe('Audited');
    expect(update.after?.name).toBe('Audited 2');

    const u = await fx.user();
    await call('patch', `/api/v1/users/${u.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } });
    expect(await fx.auditActions(u.id)).toEqual(expect.arrayContaining(['user.create', 'user.status']));
  });

  it('BE-F16-02 the application role cannot UPDATE, DELETE or TRUNCATE audit_logs, and can INSERT and SELECT', async () => {
    await newCustomer('For the log');
    await asAppRole(async (c) => {
      const expectDenied = (sql: string) => expect(c.query(sql)).rejects.toThrow(/permission denied/);
      await expectDenied(`UPDATE audit_logs SET action = 'x'`);
      await expectDenied('DELETE FROM audit_logs');
      await expectDenied('TRUNCATE audit_logs');
      expect((await c.query('SELECT count(*) AS n FROM audit_logs')).rows[0].n).not.toBe('0');
      await c.query(`INSERT INTO audit_logs (entity, action) VALUES ('test', 'test.insert')`);
    });
  });

  it('BE-F16-03 the application role cannot drop triggers, alter the table or give itself rights', async () => {
    const { user } = await appRoleUrl();
    await asAppRole(async (c) => {
      await expect(c.query('ALTER TABLE audit_logs DISABLE TRIGGER ALL')).rejects.toThrow(/must be owner/);
      await expect(c.query('DROP TABLE audit_logs')).rejects.toThrow(/must be owner/);
      await expect(c.query('CREATE TABLE evil (id int)')).rejects.toThrow(/permission denied/);
      await c.query(`GRANT UPDATE ON audit_logs TO "${user}"`).catch(() => undefined);
      await expect(c.query(`UPDATE audit_logs SET action = 'x'`)).rejects.toThrow(/permission denied/);
      await expect(c.query('SELECT * FROM _prisma_migrations')).rejects.toThrow(/permission denied/);
    });
  });

  it('BE-F16-04 passwords, tokens and 2FA codes never reach the log', async () => {
    const email = fx.email('masked');
    await call('post', '/api/v1/users', {
      token: fx.admin,
      body: { email, full_name: 'Masked', password: USER_PASSWORD, memberships: [{ company_id: fx.companyA, role_id: fx.roles.sales }] },
    });
    const s = await fx.session(email);
    await call('post', '/api/v1/me/password', { token: s.access, body: { current_password: USER_PASSWORD, new_password: NEW_PASSWORD } });
    const rows = await fx.sql('SELECT * FROM audit_logs');
    const text = JSON.stringify(rows);
    for (const secret of [USER_PASSWORD, NEW_PASSWORD, s.access, s.refresh]) expect(text).not.toContain(secret);
    expect(text).not.toMatch(/passwordHash|password_hash|tokenVersion|\$argon2/);
  });

  it('BE-F16-05 GET /audit-logs filters and pages; 403 for accountant and sale; an owner stays in their company', async () => {
    await newCustomer('In A', fx.admin, fx.companyA);
    await newCustomer('In B', fx.admin, fx.companyB);

    const all = await call('get', '/api/v1/audit-logs?action=customer.create&page=1&page_size=1', {
      token: fx.admin,
      company: fx.companyA,
    });
    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(1);
    expect(all.body.total).toBeGreaterThanOrEqual(2);
    expect(all.body.page_size).toBe(1);
    const second = await call('get', '/api/v1/audit-logs?action=customer.create&page=2&page_size=1', {
      token: fx.admin,
      company: fx.companyA,
    });
    expect(second.body.items[0].id).not.toBe(all.body.items[0].id);
    const byEntity = await call('get', '/api/v1/audit-logs?entity_type=role', { token: fx.admin, company: fx.companyA });
    expect(byEntity.body.items.every((r: { entity: string }) => r.entity === 'role')).toBe(true);
    expect((await call('get', '/api/v1/audit-logs?from=yesterday', { token: fx.admin, company: fx.companyA })).status).toBe(422);
    expect((await call('get', '/api/v1/audit-logs?page_size=100000', { token: fx.admin, company: fx.companyA })).status).toBe(422);
    expect(
      (
        await call('get', `/api/v1/audit-logs?to=${new Date(Date.now() - 86_400_000).toISOString()}`, {
          token: fx.admin,
          company: fx.companyA,
        })
      ).body.total,
    ).toBe(0);

    for (const role of ['accountant', 'sales']) {
      const u = await fx.user(role);
      const { access } = await fx.session(u.email);
      expect((await call('get', '/api/v1/audit-logs', { token: access, company: fx.companyA })).status).toBe(403);
    }

    const owner = await fx.user('owner');
    const { access } = await fx.session(owner.email);
    const mine = await call('get', '/api/v1/audit-logs?action=customer.create&page_size=100', { token: access, company: fx.companyA });
    expect(mine.status).toBe(200);
    expect(mine.body.items.length).toBeGreaterThan(0);
    expect(mine.body.items.every((r: { company_id: string }) => r.company_id === fx.companyA)).toBe(true);
    expect((await call('get', '/api/v1/audit-logs', { token: access, company: fx.companyB })).status).toBe(403);
  });

  it('BE-F16-06 BE-F04-13 the migration applies on an existing tenant with data: a user without a role is disabled, the rest stays', async () => {
    const name = 'tenant_e2e_migration_check';
    const dir = join(__dirname, '..', 'prisma', 'tenant', 'migrations');
    const migrations = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const target = migrations.findIndex((m) => m.endsWith('auth_sessions_mfa_invitations'));
    expect(target).toBeGreaterThan(0);
    await withAdmin((a) => a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
    await withAdmin((a) => a.query(`CREATE DATABASE ${name}`));
    const url = new URL(process.env.TENANT_DB_ADMIN_URL!);
    url.pathname = `/${name}`;
    const c = new Client({ connectionString: url.toString() });
    await c.connect();
    try {
      for (const m of migrations.slice(0, target)) await c.query(readFileSync(join(dir, m, 'migration.sql'), 'utf8'));
      const role = await c.query(
        `INSERT INTO roles (id, key, name, is_system, updated_at) VALUES (gen_random_uuid(), 'sales', 'Sales', true, now()) RETURNING id`,
      );
      const insertUser = (email: string) =>
        c.query(
          `INSERT INTO users (id, email, full_name, password_hash, status, updated_at) VALUES (gen_random_uuid(), $1, 'x', 'h', 'ACTIVE', now()) RETURNING id, token_version`,
          [email],
        );
      const withRole = await insertUser('with-role@x.test');
      const without = await insertUser('no-role@x.test');
      await c.query(`INSERT INTO memberships (id, user_id, company_id, role_id) VALUES (gen_random_uuid(), $1, NULL, $2)`, [
        withRole.rows[0].id,
        role.rows[0].id,
      ]);
      await c.query(`INSERT INTO audit_logs (entity, action) VALUES ('old', 'old.row')`);

      for (const m of migrations.slice(target)) await c.query(readFileSync(join(dir, m, 'migration.sql'), 'utf8'));

      const users = await c.query(`SELECT email, status, token_version FROM users ORDER BY email`);
      expect(users.rows).toEqual([
        { email: 'no-role@x.test', status: 'DISABLED', token_version: without.rows[0].token_version + 1 },
        { email: 'with-role@x.test', status: 'ACTIVE', token_version: withRole.rows[0].token_version },
      ]);
      expect((await c.query(`SELECT count(*) AS n FROM audit_logs WHERE action = 'old.row'`)).rows[0].n).toBe('1');
      expect((await c.query(`SELECT mfa_required_for_all FROM tenant_settings`)).rows).toEqual([{ mfa_required_for_all: false }]);
    } finally {
      await c.end();
      await withAdmin((a) => a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
    }
  });

  it('BE-F16-06 migrate-tenants moves a tenant from before the application role onto it, twice without harm; the app still writes audit', async () => {
    const old = new TenantFixture(uniqueSubdomain('old'));
    old.app = fx.app;
    old.api = fx.api;
    await fx.api.createTenant(fx.platform, old.sub);
    await withControl((c) =>
      c.query('UPDATE tenants SET db_app_user = NULL, db_app_password_enc = NULL, default_company_id = NULL WHERE subdomain = $1', [
        old.sub,
      ]),
    );

    for (const _ of [1, 2]) {
      const { failed, migrated } = await migrateTenants(old.sub);
      expect(failed).toEqual([]);
      expect(migrated).toEqual([old.sub]);
    }
    const { rows } = await withControl((c) =>
      c.query('SELECT db_app_user, default_company_id FROM tenants WHERE subdomain = $1', [old.sub]),
    );
    expect(rows[0].db_app_user).toMatch(/_app$/);
    expect(rows[0].default_company_id).toBeTruthy();

    await new Promise((r) => setTimeout(r, 300));
    const before = (await old.auditActions()).length;
    expect((await old.login(`admin@${old.sub}.test`, 'Admin-Password-2026')).status).toBe(200);
    expect((await old.auditActions()).length).toBeGreaterThan(before);
  });

  it('E-AUD-01 audit cannot be written: a sensitive change fails with it; an ordinary write stands and is logged as an error', async () => {
    const u = await fx.user();
    const s = await fx.session(u.email);
    const { user } = await appRoleUrl();
    await fx.sql(`REVOKE INSERT ON audit_logs FROM "${user}"`);
    try {
      const change = await call('post', '/api/v1/me/password', {
        token: s.access,
        body: { current_password: USER_PASSWORD, new_password: NEW_PASSWORD },
      });
      expect(change.status).toBeGreaterThanOrEqual(500);
      expect(JSON.stringify(change.body)).not.toMatch(/audit_logs|permission denied|postgres/i);
      expect((await newCustomer('Written anyway')).status).toBe(201);
    } finally {
      await fx.sql(`GRANT INSERT ON audit_logs TO "${user}"`);
    }
    expect((await fx.login(u.email, NEW_PASSWORD)).status).toBe(401);
    expect((await fx.login(u.email, USER_PASSWORD)).status).toBe(200);
  });

  it('E-AUD-02 very large values are cut, and the operation is not harmed', async () => {
    const res = await call('post', '/api/v1/customers', {
      token: fx.admin,
      company: fx.companyA,
      body: { type: 'COMPANY', name: 'Big notes', notes: 'x'.repeat(40_000), addresses: [billingAddress] },
    });
    expect(res.status).toBe(201);
    const [row] = await fx.sql<{ after: { _truncated?: boolean } }>(`SELECT after FROM audit_logs WHERE entity_id = $1`, [res.body.id]);
    expect(row.after._truncated).toBe(true);
  });

  it('E-AUD-03 no user behind it (not logged in): recorded, with a clear empty actor', async () => {
    const email = fx.email('anon');
    expect((await fx.login(email, 'Wrong-Password-12')).status).toBe(401);
    const rows = await fx.sql<{ actor_type: string | null; user_id: string | null; actor_email: string }>(
      `SELECT actor_type, user_id, actor_email FROM audit_logs WHERE action = 'auth.login_failed' AND actor_email = $1`,
      [email],
    );
    expect(rows).toEqual([{ actor_type: null, user_id: null, actor_email: email }]);
  });

  it('E-AUD-04 a refused request (403, 422) leaves no row: failures are never written as successes', async () => {
    const u = await fx.user('viewer');
    const { access } = await fx.session(u.email);
    const before = (await fx.auditActions()).length;
    expect((await newCustomer('No', access)).status).toBe(403);
    expect((await call('post', '/api/v1/customers', { token: fx.admin, company: fx.companyA, body: { type: 'COMPANY' } })).status).toBe(
      422,
    );
    expect((await fx.auditActions()).length).toBe(before);
  });
});
