import { ALTERNATE_DB_HOST } from './support/alternate-db-host';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import { migrateTenants } from '../src/cli/migrate-tenants';
import { ControlPrismaService } from '../src/database/control-prisma.service';
import { DEFAULT_PASSWORD, DEFAULT_TENANT } from '../src/modules/platform/tenants/default-accounts';
import { TenantRegistryService } from '../src/modules/tenancy/tenant-registry.service';
import { Api, billingAddress, createTestApp, hostOf, uniqueSubdomain } from './support/app';
import { e2eControlDbName, withAdmin, withControl } from './support/db';

const DFM = DEFAULT_TENANT.subdomain;
const CONNECTION_INFO = /db_?cluster|db_?host|db_?port|db_?name|db_?user|db_?password|postgresql:|127\.0\.0\.1/i;

/** Tenants store a logical cluster; its address comes from TENANT_DB_HOST / TENANT_DB_PORT of the running process. */
describe('Tenant database cluster', () => {
  let app: NestExpressApplication;
  let api: Api;
  let platform: string;

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    platform = await api.platformToken();
  });
  afterAll(() => app.close());

  const row = (subdomain: string) => app.get(ControlPrismaService).tenant.findUniqueOrThrow({ where: { subdomain } });

  describe('same data under another TENANT_DB_HOST', () => {
    it('stores no network address: the control table has db_cluster only', async () => {
      const { rows } = await withControl((c) =>
        c.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants' AND column_name LIKE 'db\\_%' ORDER BY 1`),
      );
      expect(rows.map((r) => r.column_name)).toEqual([
        'db_app_password_enc',
        'db_app_user',
        'db_cluster',
        'db_name',
        'db_password_enc',
        'db_user',
      ]);
    });

    it('a tenant seeded under localhost connects through the address of this process', async () => {
      expect(process.env.TENANT_DB_HOST).toBe(ALTERNATE_DB_HOST);
      const tenant = await row(DFM);
      expect(tenant.dbCluster).toBe('default');

      const url = app.get(TenantRegistryService).connectionString(tenant);
      expect(new URL(url).hostname).toBe(ALTERNATE_DB_HOST);
      const client = new Client({ connectionString: url });
      await client.connect();
      try {
        const { rows } = await client.query('SELECT current_database() AS db, current_user AS role');
        expect(rows[0]).toEqual({ db: tenant.dbName, role: tenant.dbAppUser });
      } finally {
        await client.end();
      }

      const token = await api.login(DFM, `admin@${DFM}.local`, DEFAULT_PASSWORD);
      expect((await api.call('get', '/api/v1/companies', { host: hostOf(DFM), token })).status).toBe(200);
    });
  });

  describe('tenant lifecycle', () => {
    it('create tenant -> migrate tenants -> log in and work; isolation unchanged', async () => {
      const [a, b] = [uniqueSubdomain('clu-a'), uniqueSubdomain('clu-b')];
      await api.createTenant(platform, a);
      await api.createTenant(platform, b);
      expect((await row(a)).dbCluster).toBe('default');

      // What `npm run db:tenants:deploy` runs
      await expect(migrateTenants(a)).resolves.toEqual({ migrated: [a], failed: [] });

      const tokenA = await api.adminLogin(a);
      const company = (await api.call('get', '/api/v1/companies', { host: hostOf(a), token: tokenA })).body[0].id;
      const created = await api.call('post', '/api/v1/customers', {
        host: hostOf(a),
        token: tokenA,
        company,
        body: { type: 'COMPANY', name: 'Cluster test', addresses: [billingAddress] },
      });
      expect(created.status).toBe(201);

      const wrongTenant = await api.call('get', '/api/v1/auth/me', { host: hostOf(b), token: tokenA });
      expect(wrongTenant.status).toBe(401);
      expect(wrongTenant.body.code).toBe('WRONG_TENANT');
      const tokenB = await api.adminLogin(b);
      expect((await api.call('get', '/api/v1/customers', { host: hostOf(b), token: tokenB })).body.total).toBe(0);

      // Tenant A's role still cannot open tenant B's database
      const url = new URL(app.get(TenantRegistryService).connectionString(await row(a)));
      url.pathname = `/${(await row(b)).dbName}`;
      const cross = new Client({ connectionString: url.toString() });
      await expect(cross.connect()).rejects.toThrow(/permission denied/i);
      await cross.end().catch(() => undefined);
    });

    it('never exposes the cluster or connection data, on the tenant API nor the platform API', async () => {
      const token = await api.login(DFM, `admin@${DFM}.local`, DEFAULT_PASSWORD);
      const host = hostOf(DFM);
      const { id } = await row(DFM);
      const responses = await Promise.all([
        api.call('get', '/api/v1/auth/me', { host, token }),
        api.call('get', '/api/v1/companies', { host, token }),
        api.call('get', '/platform/api/v1/tenants', { token: platform }),
        api.call('get', `/platform/api/v1/tenants/${id}`, { token: platform }),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toMatch(CONNECTION_INFO);
      }
    });
  });

  describe('unknown cluster', () => {
    it('fails clearly without falling back to the default cluster, and without leaking details to the client', async () => {
      const sub = uniqueSubdomain('clu-x');
      await api.createTenant(platform, sub);
      await withControl((c) => c.query(`UPDATE tenants SET db_cluster = 'eu-2' WHERE subdomain = $1`, [sub]));

      const login = await api.call('post', '/api/v1/auth/login', {
        host: hostOf(sub),
        body: { email: `admin@${sub}.test`, password: 'Admin-Password-2026' },
      });
      expect(login.status).toBe(500);
      expect(login.body.code).toBe('INTERNAL_ERROR');
      expect(login.body.message).toBe('Internal server error');

      expect(() =>
        app.get(TenantRegistryService).connectionString({ dbCluster: 'eu-2', dbName: 'x', dbUser: 'x', dbPasswordEnc: 'x' }),
      ).toThrow('Unknown database cluster "eu-2"');
      await expect(migrateTenants(sub)).resolves.toEqual({ migrated: [], failed: [sub] });
    });
  });

  describe('migration on a database with data', () => {
    const DB = `${e2eControlDbName()}_migcheck`;
    const dir = join(__dirname, '..', 'prisma', 'control', 'migrations');

    afterAll(() => withAdmin((c) => c.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`)));

    it('moves every tenant to the default cluster and keeps all other data', async () => {
      const migrations = readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      const target = migrations.findIndex((m) => m.endsWith('_tenant_db_cluster'));
      expect(target).toBeGreaterThan(0);
      const sql = (name: string) => readFileSync(join(dir, name, 'migration.sql'), 'utf8');

      await withAdmin((c) => c.query(`CREATE DATABASE ${DB}`));
      const url = new URL(process.env.TENANT_DB_ADMIN_URL!);
      url.pathname = `/${DB}`;
      const db = new Client({ connectionString: url.toString() });
      await db.connect();
      try {
        for (const name of migrations.slice(0, target)) await db.query(sql(name));

        // Rows as they exist today: one created in a container, one outside
        const plan = await db.query(
          `INSERT INTO plans (id, code, name, max_users, max_companies, max_invoices_monthly, max_ai_calls_monthly, updated_at)
           VALUES (gen_random_uuid(), 'business', 'Business', 50, 10, 5000, 10000, now()) RETURNING id`,
        );
        await db.query(
          `INSERT INTO tenants (id, name, subdomain, status, plan_id, db_host, db_port, db_name, db_user, db_password_enc, schema_version, updated_at)
           VALUES (gen_random_uuid(), 'DFM', 'dfm', 'ACTIVE', $1, 'postgres', 5432, 'tenant_dfm', 'tenant_dfm', 'v1.enc.dfm', 'v-1', now()),
                  (gen_random_uuid(), 'Acme', 'acme', 'SUSPENDED', $1, 'localhost', 6432, 'tenant_acme', 'tenant_acme', 'v1.enc.acme', 'v-2', now())`,
          [plan.rows[0].id],
        );

        await db.query(sql(migrations[target]));

        const { rows } = await db.query(`SELECT * FROM tenants ORDER BY subdomain`);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
          subdomain: 'acme',
          status: 'SUSPENDED',
          db_cluster: 'default',
          db_name: 'tenant_acme',
          db_password_enc: 'v1.enc.acme',
        });
        expect(rows[1]).toMatchObject({
          subdomain: 'dfm',
          status: 'ACTIVE',
          db_cluster: 'default',
          db_name: 'tenant_dfm',
          db_user: 'tenant_dfm',
          db_password_enc: 'v1.enc.dfm',
          schema_version: 'v-1',
        });
        expect(rows[0]).not.toHaveProperty('db_host');
        expect(rows[0]).not.toHaveProperty('db_port');
      } finally {
        await db.end();
      }
    });
  });
});
