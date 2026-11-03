import { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import { Api, billingAddress, createTestApp, hostOf, uniqueSubdomain } from './support/app';
import { tenantCredentials, tenantUrl, withTenantDb } from './support/db';

/** NFR "Tenant isolation": cross-tenant access must fail at the API and at the database. */
describe('Tenant isolation', () => {
  let app: NestExpressApplication;
  let api: Api;
  const a = uniqueSubdomain('iso-a');
  const b = uniqueSubdomain('iso-b');
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    const platform = await api.platformToken();
    await api.createTenant(platform, a);
    await api.createTenant(platform, b);
    tokenA = await api.adminLogin(a);
    tokenB = await api.adminLogin(b);
  });
  afterAll(() => app.close());

  it('rejects a token of tenant A on tenant B subdomain with 401 WRONG_TENANT (F02 BR-04, F01 TC-04)', async () => {
    for (const path of ['/api/v1/auth/me', '/api/v1/companies', '/api/v1/customers', '/api/v1/users', '/api/v1/roles']) {
      const res = await api.call('get', path, { host: hostOf(b), token: tokenA });
      expect({ path, status: res.status, code: res.body.code }).toEqual({ path, status: 401, code: 'WRONG_TENANT' });
    }
  });

  it('keeps data physically separate: B never sees A records', async () => {
    const companyA = (await api.call('get', '/api/v1/companies', { host: hostOf(a), token: tokenA })).body[0].id;
    const created = await api.call('post', '/api/v1/customers', {
      host: hostOf(a),
      token: tokenA,
      company: companyA,
      body: { type: 'COMPANY', name: 'Only in A', addresses: [billingAddress] },
    });
    expect(created.status).toBe(201);

    expect((await api.call('get', '/api/v1/customers', { host: hostOf(b), token: tokenB })).body.total).toBe(0);
    // A's company id does not exist in B's database
    const res = await api.call('get', '/api/v1/customers', { host: hostOf(b), token: tokenB, company: companyA });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('COMPANY_NOT_FOUND');
  });

  it("tenant A's database role cannot connect to tenant B's database nor to the control plane", async () => {
    const credsA = await tenantCredentials(a);
    const credsB = await tenantCredentials(b);
    const controlDb = new URL(process.env.CONTROL_DATABASE_URL!).pathname.slice(1);
    for (const target of [credsB.dbName, controlDb]) {
      const client = new Client({ connectionString: tenantUrl(credsA, target) });
      await expect(client.connect()).rejects.toThrow(/permission denied/i);
      await client.end().catch(() => undefined);
    }
  });

  it('audit_logs is append-only for the application role (F16 AC-02)', async () => {
    await withTenantDb(a, async (db) => {
      await db.query(`INSERT INTO audit_logs (entity, action) VALUES ('test', 'insert')`);
      await expect(db.query(`UPDATE audit_logs SET action = 'tampered'`)).rejects.toThrow(/append-only/);
      await expect(db.query('DELETE FROM audit_logs')).rejects.toThrow(/append-only/);
      await expect(db.query('TRUNCATE audit_logs')).rejects.toThrow(/append-only/);
    });
  });

  it('allows at most one tenant-wide membership per user (NULLS NOT DISTINCT)', async () => {
    await withTenantDb(a, async (db) => {
      const { rows } = await db.query(`SELECT user_id, role_id FROM memberships WHERE company_id IS NULL LIMIT 1`);
      await expect(
        db.query('INSERT INTO memberships (id, user_id, company_id, role_id) VALUES (gen_random_uuid(), $1, NULL, $2)', [
          rows[0].user_id,
          rows[0].role_id,
        ]),
      ).rejects.toThrow(/duplicate key/);
    });
  });
});
