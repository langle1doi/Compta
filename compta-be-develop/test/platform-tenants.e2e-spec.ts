import { NestExpressApplication } from '@nestjs/platform-express';
import { ADVISORY_LOCKS, withAdvisoryLock } from '../src/database/advisory-lock';
import { StorageService, tenantObjectKey } from '../src/modules/storage/storage.service';
import { TenantProvisionerService } from '../src/modules/platform/tenants/tenant-provisioner.service';
import { TenantUsageService, USAGE_MAX_AGE_MS } from '../src/modules/platform/tenants/tenant-usage.service';
import { PURGE_AFTER_MS } from '../src/modules/platform/tenants/tenants.service';
import { PLATFORM_OPERATOR, PLATFORM_SUPPORT } from '../src/modules/rbac/platform-catalog';
import { TenantRegistryService } from '../src/modules/tenancy/tenant-registry.service';
import { UsersService } from '../src/modules/users/users.service';
import { Api, createTestApp, hostOf, uniqueSubdomain, USER_PASSWORD } from './support/app';
import { withControl } from './support/db';

const PASSWORD = 'Platform-Admin-2026';

describe('Platform: tenant list, status, plans (F01)', () => {
  let app: NestExpressApplication;
  let api: Api;
  let token: string;
  let support: string;
  let operator: string;
  const list = (query = '') => api.call('get', `/platform/api/v1/tenants${query}`, { token });
  const plans = () => api.call('get', '/platform/api/v1/plans', { token });
  const planId = async (code: string) => (await plans()).body.find((p: { code: string }) => p.code === code).id as string;
  const newPlan = (body: object = {}) =>
    api.call('post', '/platform/api/v1/plans', {
      token,
      body: {
        code: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
        name: 'Test plan',
        max_users: 5,
        max_companies: 2,
        max_invoices_monthly: 10,
        max_ai_calls_monthly: 10,
        max_storage_gb: 1,
        ...body,
      },
    });

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    token = await api.platformToken();
    const roles = (await api.call('get', '/platform/api/v1/roles', { token })).body as { id: string; key: string }[];
    const account = async (key: string) => {
      const email = `${key.toLowerCase()}-${Date.now().toString(36)}@platform.test`;
      const role_id = roles.find((r) => r.key === key)!.id;
      const res = await api.call('post', '/platform/api/v1/users', { token, body: { email, full_name: key, password: PASSWORD, role_id } });
      expect(res.status).toBe(201);
      return api.platformToken(email, PASSWORD);
    };
    support = await account(PLATFORM_SUPPORT);
    operator = await account(PLATFORM_OPERATOR);
  });
  afterAll(() => app.close());

  describe('BE-F01-16: list', () => {
    const marker = `e2e-zq${Date.now().toString(36)}`;
    const subs = [`${marker}-a`, `${marker}-b`, `${marker}-c`];

    beforeAll(async () => {
      await api.createTenant(token, subs[0], { plan: 'starter' });
      await api.createTenant(token, subs[1], { plan: 'business' });
      const c = await api.createTenant(token, subs[2], { plan: 'business' });
      const res = await api.call('patch', `/platform/api/v1/tenants/${c.id}/status`, {
        token,
        body: { status: 'SUSPENDED', confirm_name: `Tenant ${subs[2]}` },
      });
      expect(res.status).toBe(200);
    });

    it('returns items, total, page, page_size and counts of every status', async () => {
      const res = await list(`?keyword=${marker}&page=1&page_size=2&sort=subdomain&order=asc`);
      expect(res.status).toBe(200);
      expect(res.body.items.map((t: { subdomain: string }) => t.subdomain)).toEqual([subs[0], subs[1]]);
      expect(res.body).toMatchObject({ total: 3, page: 1, page_size: 2 });
      expect(Object.keys(res.body.counts).sort()).toEqual(['active', 'deleted', 'failed', 'provisioning', 'suspended']);
      expect(res.body.counts.active).toBeGreaterThanOrEqual(2);
      expect(res.body.counts.suspended).toBeGreaterThanOrEqual(1);
      const second = await list(`?keyword=${marker}&page=2&page_size=2&sort=subdomain&order=asc`);
      expect(second.body.items.map((t: { subdomain: string }) => t.subdomain)).toEqual([subs[2]]);
    });

    it('filters by status, plan and keyword (name or subdomain, any case); counts ignore the filters', async () => {
      const all = await list(`?keyword=${marker}`);
      const suspended = await list(`?keyword=${marker}&status=SUSPENDED`);
      expect(suspended.body.items.map((t: { subdomain: string }) => t.subdomain)).toEqual([subs[2]]);
      expect(suspended.body.counts).toEqual(all.body.counts);
      const starter = await list(`?keyword=${marker}&plan=starter`);
      expect(starter.body.items.map((t: { subdomain: string }) => t.subdomain)).toEqual([subs[0]]);
      expect((await list(`?keyword=${marker.toUpperCase()}`)).body.total).toBe(3);
      expect((await list('?keyword=no-such-tenant-at-all')).body).toMatchObject({ items: [], total: 0 });
    });

    it('sorts in both directions; a keyword is plain text, not a LIKE pattern', async () => {
      const desc = await list(`?keyword=${marker}&sort=subdomain&order=desc`);
      expect(desc.body.items.map((t: { subdomain: string }) => t.subdomain)).toEqual([subs[2], subs[1], subs[0]]);
      expect((await list('?keyword=%25')).body.total).toBe(0);
      expect((await list('?keyword=_')).body.total).toBe(0);
    });

    it.each([
      ['E-API-01 SQL in sort', '?sort=name;DROP TABLE tenants'],
      ['E-API-01 unknown sort column', '?sort=db_password_enc'],
      ['unknown order', '?order=sideways'],
      ['E-API-02 page 0', '?page=0'],
      ['E-API-02 negative page', '?page=-1'],
      ['E-API-02 page in letters', '?page=abc'],
      ['E-API-02 huge page_size', '?page_size=100000'],
      ['unknown status', '?status=NOPE'],
      ['E-API-04 NUL in keyword', '?keyword=a%00b'],
      ['E-API-03 unknown parameter', '?tenant_id=1'],
    ])('%s: 422', async (_label, query) => {
      expect((await list(query)).status).toBe(422);
    });

    it('a keyword with SQL is just text (E-API-01)', async () => {
      const res = await list(`?keyword=${encodeURIComponent(`' OR 1=1 --`)}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
    });

    it('opens no tenant database, so a broken one cannot hurt it and its cost does not grow with tenants', async () => {
      const registry = app.get(TenantRegistryService);
      const clientFor = jest.spyOn(registry, 'clientFor');
      const res = await list('?page_size=100');
      expect(res.status).toBe(200);
      expect(clientFor).not.toHaveBeenCalled();
      clientFor.mockRestore();
    });

    it('never returns connection data', async () => {
      const res = await list('?page_size=100');
      expect(JSON.stringify(res.body)).not.toMatch(
        /db_?password|db_?user|db_?host|db_?port|db_?name|db_?cluster|db_app|provisioning_input/i,
      );
    });
  });

  describe('BE-F01-17: detail and usage', () => {
    let tenant: { id: string; subdomain: string };
    const detail = () => api.call('get', `/platform/api/v1/tenants/${tenant.id}`, { token });
    const usage = () => app.get(TenantUsageService);
    /** The round every instance runs when it starts must be over: a test then controls what the next one does. */
    const roundsSettled = async () => {
      const deadline = Date.now() + 60_000;
      while ((await usage().refreshAll()) === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 200));
    };

    beforeAll(async () => {
      tenant = await api.createTenant(token, uniqueSubdomain('usage'));
    });

    it('counts real data on first read, and list shows the snapshot', async () => {
      const res = await detail();
      expect(res.status).toBe(200);
      // Requested admin + 5 default accounts
      expect(res.body.usage).toMatchObject({ users: 6, companies: 1, invoices_this_month: 0, files_bytes: 0 });
      expect(res.body.usage.database_bytes).toBeGreaterThan(1024 * 1024);
      expect(res.body.usage.storage_bytes).toBe(res.body.usage.database_bytes);
      expect(res.body).toMatchObject({ schema_version: expect.any(String), is_outdated: false, purge_at: null });
      const row = (await list(`?keyword=${tenant.subdomain}`)).body.items[0];
      expect(row.usage).toMatchObject({ users: 6 });
    });

    it('stays cached for 15 minutes, then detail refreshes it', async () => {
      const adminToken = await api.adminLogin(tenant.subdomain);
      const companies = await api.call('get', '/api/v1/companies', { host: hostOf(tenant.subdomain), token: adminToken });
      const created = await api.call('post', '/api/v1/users', {
        host: hostOf(tenant.subdomain),
        token: adminToken,
        body: {
          email: `extra@${tenant.subdomain}.test`,
          full_name: 'Extra',
          password: USER_PASSWORD,
          memberships: [
            {
              company_id: companies.body[0].id,
              role_id: (await api.call('get', '/api/v1/roles', { host: hostOf(tenant.subdomain), token: adminToken })).body[0].id,
            },
          ],
        },
      });
      expect(created.status).toBe(201);

      expect((await detail()).body.usage.users).toBe(6);
      await withControl((c) =>
        c.query(`UPDATE tenant_usage_snapshots SET captured_at = captured_at - $2::interval WHERE tenant_id = $1`, [
          tenant.id,
          `${USAGE_MAX_AGE_MS + 1000} milliseconds`,
        ]),
      );
      expect((await detail()).body.usage.users).toBe(7);
    });

    it('E-TEN-15: a database that cannot be reached gives usage null, the list keeps working', async () => {
      const broken = await api.createTenant(token, uniqueSubdomain('broken'));
      await withControl((c) => c.query(`UPDATE tenants SET db_cluster = 'nowhere' WHERE id = $1`, [broken.id]));
      app.get(TenantRegistryService);
      try {
        expect(await usage().refreshAll()).toBeGreaterThan(0);
        const row = await list(`?keyword=${broken.subdomain}`);
        expect(row.status).toBe(200);
        expect(row.body.items[0].usage).toBeNull();
        const one = await api.call('get', `/platform/api/v1/tenants/${broken.id}`, { token });
        expect(one.status).toBe(200);
        expect(one.body.usage).toBeNull();
      } finally {
        await withControl((c) => c.query(`UPDATE tenants SET db_cluster = 'default' WHERE id = $1`, [broken.id]));
      }
    });

    it('FE-F01-04: a new tenant has its usage in the list, without anyone opening its detail', async () => {
      const subdomain = uniqueSubdomain('fresh');
      const created = await api.call('post', '/platform/api/v1/tenants', {
        token,
        body: { name: `Tenant ${subdomain}`, subdomain, admin_email: `admin@${subdomain}.test`, admin_password: 'Admin-Password-2026' },
      });
      expect(created.status).toBe(202);
      expect((await api.waitForJob(token, created.body.job_id)).status).toBe('SUCCEEDED');
      const row = (await list(`?keyword=${subdomain}`)).body.items[0];
      expect(row.usage).toMatchObject({ users: 6, companies: 1, captured_at: expect.any(String) });
      expect(row.usage.storage_bytes).toBeGreaterThan(0);
    });

    it('FE-F01-04: after a restart the list fills by itself: tenants that had no snapshot get one, without opening any detail', async () => {
      await roundsSettled();
      await withControl((c) => c.query('DELETE FROM tenant_usage_snapshots'));
      const rowOf = async (client: Api, subdomain: string) =>
        (await client.call('get', `/platform/api/v1/tenants?keyword=${subdomain}`, { token })).body.items[0];
      expect((await rowOf(api, tenant.subdomain)).usage).toBeNull();

      const restarted = await createTestApp();
      try {
        const other = new Api(restarted);
        const deadline = Date.now() + 60_000;
        let row = await rowOf(other, tenant.subdomain);
        while (row.usage === null && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          row = await rowOf(other, tenant.subdomain);
        }
        expect(row.usage).toMatchObject({ users: expect.any(Number), companies: 1 });
        expect((await rowOf(other, 'dfm')).usage).not.toBeNull();
      } finally {
        await restarted.close();
      }
    });

    it('a round uses no tenant pool, skips when another pod holds it, and a broken tenant does not stop the others', async () => {
      await roundsSettled();
      const service = usage();
      const clientFor = jest.spyOn(app.get(TenantRegistryService), 'clientFor');
      const broken = await api.createTenant(token, uniqueSubdomain('badone'));
      const good = await api.createTenant(token, uniqueSubdomain('goodone'));
      clientFor.mockClear();
      await withControl(async (c) => {
        await c.query(`UPDATE tenants SET db_cluster = 'nowhere' WHERE id = $1`, [broken.id]);
        await c.query('DELETE FROM tenant_usage_snapshots WHERE tenant_id = $1', [good.id]);
      });
      try {
        // Another pod has the round: nothing happens here
        const held = await withAdvisoryLock(process.env.CONTROL_DATABASE_URL!, ADVISORY_LOCKS.USAGE, () => service.refreshAll());
        expect(held).toEqual({ ran: true, result: 0 });
        expect((await list(`?keyword=${good.subdomain}`)).body.items[0].usage).toBeNull();

        expect(await service.refreshAll()).toBeGreaterThan(1);
        expect(clientFor).not.toHaveBeenCalled();
        expect((await list(`?keyword=${broken.subdomain}`)).body.items[0].usage).toBeNull();
        expect((await list(`?keyword=${good.subdomain}`)).body.items[0].usage).toMatchObject({ users: 6 });
      } finally {
        clientFor.mockRestore();
        await withControl((c) => c.query(`UPDATE tenants SET db_cluster = 'default' WHERE id = $1`, [broken.id]));
      }
    });

    it('storage counts the database and the files; exports do not count', async () => {
      const t = await api.createTenant(token, uniqueSubdomain('bytes'));
      const storage = app.get(StorageService);
      await storage.putBuffer(tenantObjectKey(t.id, 'documents/a.bin'), Buffer.alloc(2048), 'application/octet-stream');
      await storage.putBuffer(tenantObjectKey(t.id, 'exports/x.zip'), Buffer.alloc(4096), 'application/zip');
      await usage().refreshAll();
      const row = (await list(`?keyword=${t.subdomain}`)).body.items[0];
      expect(row.usage.files_bytes).toBe(2048);
      expect(row.usage.database_bytes).toBeGreaterThan(1024 * 1024);
      expect(row.usage.storage_bytes).toBe(row.usage.database_bytes + 2048);
    });

    it('E-API-05: bad id 400, unknown id 404', async () => {
      expect((await api.call('get', '/platform/api/v1/tenants/not-a-uuid', { token })).status).toBe(400);
      expect((await api.call('get', '/platform/api/v1/tenants/00000000-0000-4000-8000-000000000000', { token })).status).toBe(404);
    });
  });

  describe('BE-F01-14, BE-F01-15, BE-F01-10: status changes', () => {
    let tenant: { id: string; subdomain: string };
    const name = () => `Tenant ${tenant.subdomain}`;
    const setStatus = (body: object, as = token) => api.call('patch', `/platform/api/v1/tenants/${tenant.id}/status`, { token: as, body });

    beforeEach(async () => {
      tenant = await api.createTenant(token, uniqueSubdomain('st'));
    });

    it('BE-F01-15: suspending without, or with a wrong, confirm_name is 422 and changes nothing', async () => {
      for (const body of [
        { status: 'SUSPENDED' },
        { status: 'SUSPENDED', confirm_name: 'nope' },
        { status: 'SUSPENDED', confirm_name: `${name()} ` },
        { status: 'SUSPENDED', confirm_name: name().toUpperCase() },
      ]) {
        const res = await setStatus(body);
        expect(res.status).toBe(422);
        expect(res.body.fields).toEqual([expect.objectContaining({ field: 'confirm_name', code: 'CONFIRM_NAME_MISMATCH' })]);
      }
      const got = await api.call('get', `/platform/api/v1/tenants/${tenant.id}`, { token });
      expect(got.body.status).toBe('ACTIVE');
    });

    it('BE-F01-15: deleting needs it too; reactivating does not; every change is audited', async () => {
      expect((await setStatus({ status: 'SUSPENDED', confirm_name: name(), reason: 'contract ended' })).status).toBe(200);
      expect((await setStatus({ status: 'DELETED' })).status).toBe(422);
      expect((await setStatus({ status: 'ACTIVE' })).status).toBe(200);
      const { rows } = await withControl((c) =>
        c.query(`SELECT before, after FROM platform_audit_logs WHERE action = 'tenant.status' AND target_id = $1 ORDER BY id`, [tenant.id]),
      );
      expect(rows[0]).toMatchObject({ before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED', reason: 'contract ended' } });
      expect(rows[1]).toMatchObject({ before: { status: 'SUSPENDED' }, after: { status: 'ACTIVE' } });
    });

    it('BE-F01-14: a transition outside the diagram is 409, checked before the name', async () => {
      const res = await setStatus({ status: 'DELETED' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('BE-F01-10: delete blocks at once, purge_at is 30 days later; the data stays', async () => {
      expect((await setStatus({ status: 'SUSPENDED', confirm_name: name() })).status).toBe(200);
      const deleted = await setStatus({ status: 'DELETED', confirm_name: name() });
      expect(deleted.status).toBe(200);
      expect(new Date(deleted.body.purge_at).getTime() - new Date(deleted.body.deleted_at).getTime()).toBe(PURGE_AFTER_MS);
      const blocked = await api.call('get', '/api/v1/auth/me', { host: hostOf(tenant.subdomain) });
      expect(blocked.status).toBe(404);
    });

    it('E-TEN-10: the subdomain of a DELETED tenant stays taken', async () => {
      expect((await setStatus({ status: 'SUSPENDED', confirm_name: name() })).status).toBe(200);
      expect((await setStatus({ status: 'DELETED', confirm_name: name() })).status).toBe(200);
      const res = await api.call('post', '/platform/api/v1/tenants', {
        token,
        body: { name: 'again', subdomain: tenant.subdomain, admin_email: 'a@b.test', admin_password: 'Admin-Password-2026' },
      });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('SUBDOMAIN_TAKEN');
    });

    it('E-TEN-11: a request already running when the tenant is suspended finishes normally; the next one is refused', async () => {
      const host = hostOf(tenant.subdomain);
      const adminToken = await api.adminLogin(tenant.subdomain);
      const users = app.get(UsersService, { strict: false });
      const real = users.list.bind(users);
      let entered!: () => void;
      let release!: () => void;
      const inside = new Promise<void>((resolve) => (entered = resolve));
      const gate = new Promise<void>((resolve) => (release = resolve));
      // Stops the handler after the guards and before its query
      const spy = jest.spyOn(users, 'list').mockImplementationOnce(((access: Parameters<typeof real>[0]) => {
        entered();
        return gate.then(() => real(access));
      }) as never);
      const running = api.call('get', '/api/v1/users', { host, token: adminToken }).then((res) => res);
      await inside;

      expect((await setStatus({ status: 'SUSPENDED', confirm_name: name() })).status).toBe(200);
      const next = await api.call('get', '/api/v1/users', { host, token: adminToken });
      expect(next.status).toBe(403);
      expect(next.body.code).toBe('TENANT_SUSPENDED');

      release();
      const finished = await running;
      spy.mockRestore();
      expect(finished.status).toBe(200);
      expect(finished.body.length ?? finished.body.items.length).toBeGreaterThan(0);
    });

    it('BE-F01-07: suspending reaches another instance at once through NOTIFY: API and login refused, data intact, back on reactivation', async () => {
      const host = hostOf(tenant.subdomain);
      const other = await createTestApp();
      try {
        const otherApi = new Api(other);
        const adminToken = await api.adminLogin(tenant.subdomain);
        // The other instance has the tenant in its 60-second cache
        const before = await otherApi.call('get', '/api/v1/users', { host, token: adminToken });
        expect(before.status).toBe(200);

        expect((await setStatus({ status: 'SUSPENDED', confirm_name: name() })).status).toBe(200);
        const deadline = Date.now() + 2000;
        let res = await otherApi.call('get', '/api/v1/users', { host, token: adminToken });
        while (res.status === 200 && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          res = await otherApi.call('get', '/api/v1/users', { host, token: adminToken });
        }
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('TENANT_SUSPENDED');
        const login = await otherApi.call('post', '/api/v1/auth/login', {
          host,
          body: { email: `admin@${tenant.subdomain}.test`, password: 'Admin-Password-2026' },
        });
        expect(login.status).toBe(403);
        expect(login.body.code).toBe('TENANT_SUSPENDED');

        expect((await setStatus({ status: 'ACTIVE' })).status).toBe(200);
        const backDeadline = Date.now() + 2000;
        let back = await otherApi.call('get', '/api/v1/users', { host, token: adminToken });
        while (back.status !== 200 && Date.now() < backDeadline) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          back = await otherApi.call('get', '/api/v1/users', { host, token: adminToken });
        }
        expect(back.status).toBe(200);
        expect(back.body).toEqual(before.body);
      } finally {
        await other.close();
      }
    });

    it('E-TEN-09: nothing but provisioning can leave PROVISIONING, not even to ACTIVE', async () => {
      await withControl((c) => c.query(`UPDATE tenants SET status = 'PROVISIONING' WHERE id = $1`, [tenant.id]));
      try {
        for (const body of [
          { status: 'ACTIVE' },
          { status: 'SUSPENDED', confirm_name: name() },
          { status: 'DELETED', confirm_name: name() },
        ]) {
          const res = await setStatus(body);
          expect(res.status).toBe(409);
        }
      } finally {
        await withControl((c) => c.query(`UPDATE tenants SET status = 'ACTIVE' WHERE id = $1`, [tenant.id]));
      }
    });

    it('E-TEN-09: suspend and delete at the same moment answer one of each, without a wrong state', async () => {
      expect((await setStatus({ status: 'SUSPENDED', confirm_name: name() })).status).toBe(200);
      const results = await Promise.all([setStatus({ status: 'DELETED', confirm_name: name() }), setStatus({ status: 'ACTIVE' })]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it('role rules: Operator suspends but cannot delete; Support does neither', async () => {
      expect((await setStatus({ status: 'SUSPENDED', confirm_name: name() }, support)).status).toBe(403);
      expect((await setStatus({ status: 'SUSPENDED', confirm_name: name() }, operator)).status).toBe(200);
      const res = await setStatus({ status: 'DELETED', confirm_name: name() }, operator);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('BE-F01-18: change plan', () => {
    it('applies at once, new limit in force, old data readable, audited, warns when already over (E-TEN-12)', async () => {
      const tenant = await api.createTenant(token, uniqueSubdomain('plan'));
      const host = hostOf(tenant.subdomain);
      const adminToken = await api.adminLogin(tenant.subdomain);
      await api.call('get', `/platform/api/v1/tenants/${tenant.id}`, { token });

      const small = await newPlan({ max_users: 2 });
      expect(small.status).toBe(201);
      const changed = await api.call('patch', `/platform/api/v1/tenants/${tenant.id}/plan`, { token, body: { plan_id: small.body.id } });
      expect(changed.status).toBe(200);
      expect(changed.body.plan.id).toBe(small.body.id);
      expect(changed.body.over_limits).toEqual(['users']);

      const companies = await api.call('get', '/api/v1/companies', { host, token: adminToken });
      const roles = await api.call('get', '/api/v1/roles', { host, token: adminToken });
      const blocked = await api.call('post', '/api/v1/users', {
        host,
        token: adminToken,
        body: {
          email: `over@${tenant.subdomain}.test`,
          full_name: 'Over',
          password: USER_PASSWORD,
          memberships: [{ company_id: companies.body[0].id, role_id: roles.body[0].id }],
        },
      });
      expect(blocked.status).toBe(402);
      expect(blocked.body.code).toBe('PLAN_LIMIT_REACHED');
      expect((await api.call('get', '/api/v1/users', { host, token: adminToken })).status).toBe(200);

      const { rows } = await withControl((c) =>
        c.query(`SELECT after FROM platform_audit_logs WHERE action = 'tenant.plan' AND target_id = $1`, [tenant.id]),
      );
      expect(rows[0].after.plan).toBe(small.body.code);
    });

    it('editing a plan applies at once on tenants using it', async () => {
      const big = await newPlan({ max_users: 100 });
      const tenant = await api.createTenant(token, uniqueSubdomain('edit'), { plan: big.body.code });
      const host = hostOf(tenant.subdomain);
      const adminToken = await api.adminLogin(tenant.subdomain);
      const companies = await api.call('get', '/api/v1/companies', { host, token: adminToken });
      const roles = await api.call('get', '/api/v1/roles', { host, token: adminToken });
      const body = (n: number) => ({
        email: `u${n}@${tenant.subdomain}.test`,
        full_name: 'U',
        password: USER_PASSWORD,
        memberships: [{ company_id: companies.body[0].id, role_id: roles.body[0].id }],
      });
      expect((await api.call('post', '/api/v1/users', { host, token: adminToken, body: body(1) })).status).toBe(201);
      expect((await api.call('patch', `/platform/api/v1/plans/${big.body.id}`, { token, body: { max_users: 1 } })).status).toBe(200);
      expect((await api.call('post', '/api/v1/users', { host, token: adminToken, body: body(2) })).status).toBe(402);
    });

    it('unknown plan 422, unknown tenant 404, deleted tenant 409', async () => {
      const tenant = await api.createTenant(token, uniqueSubdomain('planx'));
      const url = `/platform/api/v1/tenants/${tenant.id}/plan`;
      const missing = '00000000-0000-4000-8000-000000000000';
      expect((await api.call('patch', url, { token, body: { plan_id: missing } })).status).toBe(422);
      expect((await api.call('patch', url, { token, body: { plan_id: 'x' } })).status).toBe(422);
      const plan = await planId('starter');
      expect((await api.call('patch', `/platform/api/v1/tenants/${missing}/plan`, { token, body: { plan_id: plan } })).status).toBe(404);
      for (const status of ['SUSPENDED', 'DELETED']) {
        await api.call('patch', `/platform/api/v1/tenants/${tenant.id}/status`, {
          token,
          body: { status, confirm_name: `Tenant ${tenant.subdomain}` },
        });
      }
      expect((await api.call('patch', url, { token, body: { plan_id: plan } })).status).toBe(409);
    });
  });

  describe('BE-F01-19: plans', () => {
    it('create, read, update, delete an unused plan, with audit', async () => {
      const created = await newPlan();
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ max_storage_gb: 1 });
      const url = `/platform/api/v1/plans/${created.body.id}`;
      expect((await api.call('get', url, { token })).body).toMatchObject({ tenant_count: 0 });
      const patched = await api.call('patch', url, { token, body: { name: 'Renamed', max_storage_gb: 3 } });
      expect(patched.body).toMatchObject({ name: 'Renamed', max_storage_gb: 3 });
      expect((await api.call('delete', url, { token })).status).toBe(204);
      expect((await api.call('get', url, { token })).status).toBe(404);
      const { rows } = await withControl((c) =>
        c.query(`SELECT action FROM platform_audit_logs WHERE target_id = $1 ORDER BY id`, [created.body.id]),
      );
      expect(rows.map((r) => r.action)).toEqual(['plan.create', 'plan.update', 'plan.delete']);
    });

    it('refuses to delete a plan in use, or to change its code: 409 PLAN_IN_USE (E-TEN-13)', async () => {
      const plan = await newPlan();
      await api.createTenant(token, uniqueSubdomain('used'), { plan: plan.body.code });
      const url = `/platform/api/v1/plans/${plan.body.id}`;
      const del = await api.call('delete', url, { token });
      expect(del.status).toBe(409);
      expect(del.body.code).toBe('PLAN_IN_USE');
      const code = await api.call('patch', url, { token, body: { code: 'renamed-code' } });
      expect(code.status).toBe(409);
      expect(code.body.code).toBe('PLAN_IN_USE');
      expect((await api.call('patch', url, { token, body: { code: plan.body.code, name: 'Same code' } })).status).toBe(200);
    });

    it('E-TEN-13: duplicate code 409; negative or zero limits, bad values 422', async () => {
      const dup = await newPlan({ code: 'starter' });
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('PLAN_CODE_TAKEN');
      for (const body of [
        { max_users: 0 },
        { max_users: -1 },
        { max_storage_gb: 0 },
        { max_companies: 1.5 },
        { max_users: 'many' },
        { code: 'BAD CODE' },
        { name: 'a\u0000b' },
      ]) {
        expect((await newPlan(body)).status).toBe(422);
      }
      const plan = await newPlan();
      expect((await api.call('patch', `/platform/api/v1/plans/${plan.body.id}`, { token, body: { max_users: -5 } })).status).toBe(422);
    });

    it('Support reads plans but cannot change them; Operator can', async () => {
      expect((await api.call('get', '/platform/api/v1/plans', { token: support })).status).toBe(200);
      expect((await api.call('post', '/platform/api/v1/plans', { token: support, body: {} })).status).toBe(403);
      expect((await api.call('post', '/platform/api/v1/plans', { token: operator, body: {} })).status).toBe(422);
    });
  });

  describe('E-TEN-01, E-TEN-02: subdomain rules', () => {
    const create = (subdomain: string) =>
      api.call('post', '/platform/api/v1/tenants', {
        token,
        body: {
          name: 'x',
          subdomain,
          company_legal_name: 'X',
          admin_email: 'a@b.test',
          admin_full_name: 'A',
          admin_password: 'Admin-Password-2026',
        },
      });

    it.each([
      ['2 chars', 'ab', 'VALIDATION_FAILED'],
      ['31 chars', 'a'.repeat(31), 'VALIDATION_FAILED'],
      ['leading -', '-abc', 'VALIDATION_FAILED'],
      ['trailing -', 'abc-', 'VALIDATION_FAILED'],
      ['--', 'ab--cd', 'VALIDATION_FAILED'],
      ['xn--', 'xn--abc', 'VALIDATION_FAILED'],
      ['uppercase', 'Abc', 'VALIDATION_FAILED'],
      ['platform', 'platform', 'SUBDOMAIN_RESERVED'],
      ['gitlab', 'gitlab', 'SUBDOMAIN_RESERVED'],
      ['test', 'test', 'SUBDOMAIN_RESERVED'],
      ['dev', 'dev', 'SUBDOMAIN_RESERVED'],
      ['autodiscover', 'autodiscover', 'SUBDOMAIN_RESERVED'],
      ['admin', 'admin', 'SUBDOMAIN_RESERVED'],
    ])('%s: 422', async (_label, subdomain, code) => {
      const res = await create(subdomain);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe(code);
    });

    it('E-TEN-02: a database name over 63 characters is refused before anything is created, not truncated', async () => {
      const provisioner = app.get(TenantProvisionerService);
      const spy = jest
        .spyOn(provisioner, 'credentialsFor')
        .mockReturnValueOnce({ dbName: 'x'.repeat(64), dbUser: 'x'.repeat(64), password: 'p' });
      const subdomain = uniqueSubdomain('long');
      const res = await create(subdomain);
      spy.mockRestore();
      expect(res.status).toBe(422);
      expect(res.body.fields).toEqual([expect.objectContaining({ field: 'subdomain' })]);
      expect((await withControl((c) => c.query('SELECT 1 FROM tenants WHERE subdomain = $1', [subdomain]))).rows).toHaveLength(0);
    });

    it('3 and 30 characters are accepted', async () => {
      const three = 'e2e';
      const thirty = `e2e-${Date.now().toString(36)}${'x'.repeat(30)}`.slice(0, 30);
      await expect(api.createTenant(token, three)).resolves.toMatchObject({ subdomain: three });
      await expect(api.createTenant(token, thirty)).resolves.toMatchObject({ subdomain: thirty });
    });
  });
});
