import { NestExpressApplication } from '@nestjs/platform-express';
import { hashPassword } from '../src/modules/auth/password';
import { encryptSecret } from '../src/common/crypto/secret-box';
import { JobsService, parseJobMessage } from '../src/modules/platform/jobs/jobs.service';
import * as tenantMigrator from '../src/modules/platform/tenants/tenant-migrator';
import { TenantProvisioningService } from '../src/modules/platform/tenants/tenant-provisioning.service';
import * as tenantSeeder from '../src/modules/platform/tenants/tenant-seeder';
import { NonRetryableError } from '../src/modules/queue/queue-retry';
import { QueueService } from '../src/modules/queue/queue.service';
import { ADMIN_PASSWORD, Api, createTestApp, hostOf, uniqueSubdomain } from './support/app';
import { tenantDbNameOf, withAdmin, withControl } from './support/db';

describe('Platform: tenants & Super Admin (F01)', () => {
  let app: NestExpressApplication;
  let api: Api;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    token = await api.platformToken();
  });
  afterAll(() => app.close());

  describe('provisioning', () => {
    let tenant: { id: string; subdomain: string; status: string; schema_version: string };

    beforeAll(async () => {
      tenant = await api.createTenant(token, uniqueSubdomain('prov'));
    });

    it('creates an ACTIVE tenant with its own database, records the schema version, never returns DB credentials', async () => {
      expect(tenant.status).toBe('ACTIVE');
      expect(tenant.schema_version).toMatch(/^\d{14}_/);
      const res = await api.call('get', `/platform/api/v1/tenants/${tenant.id}`, { token });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).not.toEqual(expect.arrayContaining(['db_password_enc']));
      expect(JSON.stringify(res.body)).not.toMatch(/db_?password|db_?user|db_?host|db_?port|db_?name|db_?cluster/i);

      const { rows } = await withAdmin((c) => c.query('SELECT 1 FROM pg_database WHERE datname = $1', [tenantDbNameOf(tenant.subdomain)]));
      expect(rows).toHaveLength(1);
    });

    it('seeds the tenant admin who can log in on the subdomain', async () => {
      await expect(api.adminLogin(tenant.subdomain)).resolves.toEqual(expect.any(String));
    });

    it('rejects a duplicate subdomain with 422 SUBDOMAIN_TAKEN (AC-02)', async () => {
      const res = await api.call('post', '/platform/api/v1/tenants', {
        token,
        body: {
          name: 'dup',
          subdomain: tenant.subdomain,
          company_legal_name: 'X',
          admin_email: 'a@b.test',
          admin_full_name: 'A',
          admin_password: ADMIN_PASSWORD,
        },
      });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'SUBDOMAIN_TAKEN', fields: [expect.objectContaining({ field: 'subdomain' })] });
    });

    it.each([
      ['reserved', 'admin', 'SUBDOMAIN_RESERVED'],
      ['too short', 'ab', 'VALIDATION_FAILED'],
      ['too long (31)', 'a'.repeat(31), 'VALIDATION_FAILED'],
      ['uppercase', 'Dfm', 'VALIDATION_FAILED'],
    ])('rejects a %s subdomain with 422', async (_label, subdomain, code) => {
      const res = await api.call('post', '/platform/api/v1/tenants', {
        token,
        body: {
          name: 'x',
          subdomain,
          company_legal_name: 'X',
          admin_email: 'a@b.test',
          admin_full_name: 'A',
          admin_password: ADMIN_PASSWORD,
        },
      });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe(code);
    });

    it('rejects a weak admin password (F02 BR-01: >= 12 chars, not common)', async () => {
      for (const admin_password of ['Short-123', 'password1234']) {
        const res = await api.call('post', '/platform/api/v1/tenants', {
          token,
          body: {
            name: 'x',
            subdomain: uniqueSubdomain('weak'),
            company_legal_name: 'X',
            admin_email: 'a@b.test',
            admin_full_name: 'A',
            admin_password,
          },
        });
        expect(res.status).toBe(422);
        expect(res.body.fields).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'admin_password' })]));
      }
    });
  });

  describe('lifecycle state machine (BR-03)', () => {
    let tenant: { id: string; subdomain: string };
    let tenantToken: string;
    const setStatus = (status: string) =>
      api.call('patch', `/platform/api/v1/tenants/${tenant.id}/status`, {
        token,
        body: { status, ...(status !== 'ACTIVE' && { confirm_name: `Tenant ${tenant.subdomain}` }) },
      });

    beforeAll(async () => {
      tenant = await api.createTenant(token, uniqueSubdomain('life'));
      tenantToken = await api.adminLogin(tenant.subdomain);
    });

    it('SUSPENDED blocks every tenant request with 403 TENANT_SUSPENDED (AC-04), ACTIVE restores it', async () => {
      expect((await setStatus('SUSPENDED')).status).toBe(200);
      const me = await api.call('get', '/api/v1/auth/me', { host: hostOf(tenant.subdomain), token: tenantToken });
      expect(me.status).toBe(403);
      expect(me.body.code).toBe('TENANT_SUSPENDED');

      expect((await setStatus('ACTIVE')).status).toBe(200);
      expect((await api.call('get', '/api/v1/auth/me', { host: hostOf(tenant.subdomain), token: tenantToken })).status).toBe(200);
    });

    it('ACTIVE cannot go straight to DELETED: suspend first (409 INVALID_STATUS_TRANSITION)', async () => {
      const res = await setStatus('DELETED');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('SUSPENDED -> DELETED blocks access immediately and is final (409 on any further transition)', async () => {
      expect((await setStatus('SUSPENDED')).status).toBe(200);
      expect((await setStatus('DELETED')).status).toBe(200);
      const me = await api.call('get', '/api/v1/auth/me', { host: hostOf(tenant.subdomain), token: tenantToken });
      // E-AUTH-06: with a token the tenant is simply gone for that token
      expect(me.status).toBe(401);

      for (const status of ['ACTIVE', 'SUSPENDED']) {
        const res = await setStatus(status);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
      }
    });
  });

  describe('failed provisioning (AC-03)', () => {
    const provision = (subdomain: string) =>
      api.call('post', '/platform/api/v1/tenants', {
        token,
        body: {
          name: 'fail',
          subdomain,
          plan_code: 'business',
          company_legal_name: 'F SAS',
          admin_email: `admin@${subdomain}.test`,
          admin_full_name: 'A',
          admin_password: ADMIN_PASSWORD,
        },
      });
    const retry = (id: string) =>
      api.call('post', `/platform/api/v1/tenants/${id}/retry`, { token, body: { admin_password: ADMIN_PASSWORD } });
    const finished = async (res: { status: number; body: { job_id: string } }) => {
      expect(res.status).toBe(202);
      return api.waitForJob(token, res.body.job_id);
    };
    const tenantRow = async (subdomain: string) => {
      const { rows } = await withControl((c) =>
        c.query('SELECT id, status, failure_reason FROM tenants WHERE subdomain = $1', [subdomain]),
      );
      return rows[0];
    };
    const roleExists = async (role: string) =>
      (await withAdmin((c) => c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]))).rows.length === 1;
    const dbExists = async (db: string) =>
      (await withAdmin((c) => c.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]))).rows.length === 1;

    it('E-TEN-04: a role of the same name that this tenant did not create stays, FAILED, retry works once it is gone', async () => {
      const subdomain = uniqueSubdomain('fail');
      const role = tenantDbNameOf(subdomain);
      await withAdmin((c) => c.query(`CREATE ROLE "${role}"`));

      const failed = await finished(await provision(subdomain));
      expect(failed).toMatchObject({ status: 'FAILED', step: 'create_database', result: { failed_step: 'create_database' } });

      const row = await tenantRow(subdomain);
      expect(row).toMatchObject({ status: 'FAILED', failure_reason: expect.stringContaining('create_database') });
      // The role name is connection data: the reason shown to the Super Admin must not carry it
      expect(row.failure_reason).not.toContain(role);
      expect(await roleExists(role)).toBe(true);

      // Retrying does not take it over either
      expect((await finished(await retry(row.id))).status).toBe('FAILED');
      expect(await roleExists(role)).toBe(true);
      expect((await tenantRow(subdomain)).status).toBe('FAILED');

      await withAdmin((c) => c.query(`DROP ROLE "${role}"`));
      expect((await finished(await retry(row.id))).status).toBe('SUCCEEDED');
      expect((await tenantRow(subdomain)).status).toBe('ACTIVE');
      await expect(api.adminLogin(subdomain)).resolves.toEqual(expect.any(String));

      // Only FAILED tenants can be retried
      expect((await retry(row.id)).status).toBe(409);
    });

    it('E-TEN-04: a database of the same name that this tenant did not create stays; what this run created is removed', async () => {
      const subdomain = uniqueSubdomain('faildb');
      const db = tenantDbNameOf(subdomain);
      await withAdmin((c) => c.query(`CREATE DATABASE "${db}"`));
      try {
        expect((await finished(await provision(subdomain))).status).toBe('FAILED');
        expect(await tenantRow(subdomain)).toMatchObject({ status: 'FAILED', failure_reason: expect.stringContaining('create_database') });
        expect(await dbExists(db)).toBe(true);
        expect(await roleExists(db)).toBe(false);
      } finally {
        await withAdmin((c) => c.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`));
      }
    });

    it('E-TEN-04: a database owned by a role of the same name, both foreign, both stay', async () => {
      const subdomain = uniqueSubdomain('failboth');
      const name = tenantDbNameOf(subdomain);
      await withAdmin(async (c) => {
        await c.query(`CREATE ROLE "${name}"`);
        await c.query(`CREATE DATABASE "${name}" OWNER "${name}"`);
      });
      try {
        expect((await finished(await provision(subdomain))).status).toBe('FAILED');
        expect(await dbExists(name)).toBe(true);
        expect(await roleExists(name)).toBe(true);
      } finally {
        await withAdmin(async (c) => {
          await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
          await c.query(`DROP ROLE IF EXISTS "${name}"`);
        });
      }
    });

    it('BE-F01-04 (AC-03): a failure after the database exists removes what this run created, retry succeeds', async () => {
      const subdomain = uniqueSubdomain('failseed');
      const name = tenantDbNameOf(subdomain);
      const seeder = jest.spyOn(tenantSeeder, 'seedTenant').mockRejectedValueOnce(new Error('seed exploded'));
      const failed = await finished(await provision(subdomain));
      seeder.mockRestore();
      expect(failed).toMatchObject({ status: 'FAILED', step: 'seed' });

      const row = await tenantRow(subdomain);
      expect(row).toMatchObject({ status: 'FAILED', failure_reason: expect.stringContaining('seed') });
      expect(row.failure_reason).not.toContain('exploded');
      expect(await dbExists(name)).toBe(false);
      expect(await roleExists(name)).toBe(false);

      expect((await finished(await retry(row.id))).status).toBe('SUCCEEDED');
      await expect(api.adminLogin(subdomain)).resolves.toEqual(expect.any(String));
    });
  });

  describe('provisioning interrupted by a killed process', () => {
    const subdomain = uniqueSubdomain('kill');
    const dbName = tenantDbNameOf(subdomain);
    const interrupt = (id: string, age: string) =>
      withControl((c) =>
        c.query(`UPDATE tenants SET status = 'PROVISIONING', provisioning_input = $2, updated_at = now() - $3::interval WHERE id = $1`, [
          id,
          JSON.stringify({ companyLegalName: 'K SAS', adminEmail: `admin@${subdomain}.test`, adminFullName: 'A' }),
          age,
        ]),
      );
    const retry = (id: string) =>
      api.call('post', `/platform/api/v1/tenants/${id}/retry`, { token, body: { admin_password: ADMIN_PASSWORD } });
    let id: string;

    beforeAll(async () => {
      const created = await api.call('post', '/platform/api/v1/tenants', {
        token,
        body: {
          name: 'kill',
          subdomain,
          plan_code: 'business',
          company_legal_name: 'K SAS',
          admin_email: `admin@${subdomain}.test`,
          admin_full_name: 'A',
          admin_password: ADMIN_PASSWORD,
        },
      });
      expect(created.status).toBe(202);
      await api.waitForJob(token, created.body.job_id);
      id = created.body.tenant.id;
    });

    it('a recent PROVISIONING tenant is left alone: retry answers 409, its database stays', async () => {
      await interrupt(id, '1 minute');
      expect((await retry(id)).status).toBe(409);
      const got = await api.call('get', `/platform/api/v1/tenants/${id}`, { token });
      expect(got.body.status).toBe('PROVISIONING');
      const db = await withAdmin((c) => c.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]));
      expect(db.rows).toHaveLength(1);
    });

    it('an old one becomes FAILED, and retry replaces the leftover database and role', async () => {
      await interrupt(id, '20 minutes');
      const got = await api.call('get', `/platform/api/v1/tenants/${id}`, { token });
      expect(got.body).toMatchObject({ status: 'FAILED', failure_reason: expect.stringContaining('interrupted') });

      const retried = await retry(id);
      expect(retried.status).toBe(202);
      expect((await api.waitForJob(token, retried.body.job_id)).status).toBe('SUCCEEDED');
      await expect(api.adminLogin(subdomain)).resolves.toEqual(expect.any(String));
    });

    it('of two concurrent retries only one runs', async () => {
      await interrupt(id, '20 minutes');
      const results = await Promise.all([retry(id), retry(id)]);
      expect(results.map((r) => r.status).sort()).toEqual([202, 409]);
      const winner = results.find((r) => r.status === 202)!;
      expect((await api.waitForJob(token, winner.body.job_id)).status).toBe('SUCCEEDED');
      await expect(api.adminLogin(subdomain)).resolves.toEqual(expect.any(String));
    });
  });

  describe('background provisioning (F01 G)', () => {
    const body = (subdomain: string) => ({
      name: `Tenant ${subdomain}`,
      subdomain,
      plan_code: 'business',
      company_legal_name: 'B SAS',
      admin_email: `admin@${subdomain}.test`,
      admin_full_name: 'A',
      admin_password: ADMIN_PASSWORD,
    });
    const post = (subdomain: string) => api.call('post', '/platform/api/v1/tenants', { token, body: body(subdomain) });

    it('BE-F01-01, BE-F01-02: answers 202 with the job; steps in order; ACTIVE with database, role and schema version', async () => {
      const subdomain = uniqueSubdomain('job');
      const startedAt = Date.now();
      const res = await post(subdomain);
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ tenant: expect.objectContaining({ subdomain, status: 'PROVISIONING' }), job_id: expect.any(String) });

      const job = await api.waitForJob(token, res.body.job_id);
      expect(job).toMatchObject({ status: 'SUCCEEDED', type: 'PROVISION', tenant_id: res.body.tenant.id });
      // AC-01: ACTIVE within 2 minutes
      expect(Date.now() - startedAt).toBeLessThan(2 * 60 * 1000);
      expect(job.steps.map((s: { step: string }) => s.step)).toEqual(['create_database', 'migrate', 'seed', 'invite']);
      expect(job.steps.slice(0, 3).map((s: { status: string }) => s.status)).toEqual(['DONE', 'DONE', 'DONE']);
      expect(JSON.stringify(job)).not.toMatch(/secret|password|\$argon2/i);

      const tenant = await api.call('get', `/platform/api/v1/tenants/${res.body.tenant.id}`, { token });
      expect(tenant.body).toMatchObject({ status: 'ACTIVE', schema_version: expect.stringMatching(/^\d{14}_/) });
      await expect(api.adminLogin(subdomain)).resolves.toEqual(expect.any(String));

      const row = await withControl((c) => c.query('SELECT secret_enc FROM provisioning_jobs WHERE id = $1', [res.body.job_id]));
      expect(row.rows[0].secret_enc).toBeNull();
    });

    it('E-TEN-03: two requests for one subdomain at once: one 202, one 422, no leftover', async () => {
      const subdomain = uniqueSubdomain('race');
      const results = await Promise.all([post(subdomain), post(subdomain)]);
      expect(results.map((r) => r.status).sort()).toEqual([202, 422]);
      expect(results.find((r) => r.status === 422)!.body.code).toBe('SUBDOMAIN_TAKEN');
      await api.waitForJob(token, results.find((r) => r.status === 202)!.body.job_id);
      const rows = await withControl((c) => c.query('SELECT 1 FROM tenants WHERE subdomain = $1', [subdomain]));
      expect(rows.rows).toHaveLength(1);
    });

    it('E-TEN-07: a delivery after the job finished changes nothing, the tenant stays ACTIVE', async () => {
      const subdomain = uniqueSubdomain('dup');
      const res = await post(subdomain);
      await api.waitForJob(token, res.body.job_id);
      const adminToken = await api.adminLogin(subdomain);

      await app.get(TenantProvisioningService).run(res.body.job_id);

      const job = await api.call('get', `/platform/api/v1/jobs/${res.body.job_id}`, { token });
      expect(job.body.attempt).toBe(1);
      expect((await api.call('get', '/api/v1/auth/me', { host: hostOf(subdomain), token: adminToken })).status).toBe(200);
    });

    it('E-TEN-07: a worker that died after activation: the next delivery finishes the job without touching the tenant', async () => {
      const subdomain = uniqueSubdomain('died');
      const res = await post(subdomain);
      await api.waitForJob(token, res.body.job_id);
      const adminToken = await api.adminLogin(subdomain);
      await withControl((c) =>
        c.query(`UPDATE provisioning_jobs SET status = 'RUNNING', finished_at = NULL WHERE id = $1`, [res.body.job_id]),
      );

      await app.get(TenantProvisioningService).run(res.body.job_id);

      expect((await api.call('get', `/platform/api/v1/jobs/${res.body.job_id}`, { token })).body.status).toBe('SUCCEEDED');
      expect((await api.call('get', '/api/v1/auth/me', { host: hostOf(subdomain), token: adminToken })).status).toBe(200);
    });

    it('BE-F01-05: a worker that died midway: redelivery starts over from its own leftovers, one database, ACTIVE', async () => {
      const subdomain = uniqueSubdomain('mid');
      const migrator = jest.spyOn(tenantMigrator, 'migrateTenantDatabase').mockImplementationOnce(() => {
        throw new Error('process killed');
      });
      const res = await post(subdomain);
      expect((await api.waitForJob(token, res.body.job_id)).status).toBe('FAILED');
      migrator.mockRestore();

      // As left by a killed process: tenant still provisioning, job still running, its database and role still there
      const name = tenantDbNameOf(subdomain);
      await withAdmin(async (c) => {
        await c.query(`CREATE ROLE "${name}" LOGIN`);
        await c.query(`COMMENT ON ROLE "${name}" IS 'compte-tenant:${res.body.tenant.id}'`);
        await c.query(`CREATE DATABASE "${name}" OWNER "${name}"`);
      });
      await withControl(async (c) => {
        await c.query(`UPDATE tenants SET status = 'PROVISIONING', failure_reason = NULL WHERE id = $1`, [res.body.tenant.id]);
        await c.query(`UPDATE provisioning_jobs SET status = 'RUNNING', finished_at = NULL, secret_enc = $2 WHERE id = $1`, [
          res.body.job_id,
          encryptSecret(await hashPassword(ADMIN_PASSWORD), process.env.DB_CREDENTIALS_KEY!),
        ]);
      });

      await app.get(TenantProvisioningService).run(res.body.job_id);

      expect((await api.call('get', `/platform/api/v1/jobs/${res.body.job_id}`, { token })).body.status).toBe('SUCCEEDED');
      await expect(api.adminLogin(subdomain)).resolves.toEqual(expect.any(String));
    });

    it('BE-F01-06: two deliveries of one job at the same time: one runs, the other skips', async () => {
      const subdomain = uniqueSubdomain('twin');
      const queue = app.get(QueueService);
      const publish = jest.spyOn(queue, 'publish').mockRejectedValueOnce(new Error('broker down'));
      const res = await post(subdomain);
      publish.mockRestore();
      expect(res.status).toBe(202);

      const worker = app.get(TenantProvisioningService);
      await Promise.all([worker.run(res.body.job_id), worker.run(res.body.job_id)]);

      expect((await api.call('get', `/platform/api/v1/jobs/${res.body.job_id}`, { token })).body).toMatchObject({
        status: 'SUCCEEDED',
        attempt: 1,
      });
      await expect(api.adminLogin(subdomain)).resolves.toEqual(expect.any(String));
    });

    it('E-TEN-06: broker down when queuing: still 202, the row waits, the sweeper sends it', async () => {
      const subdomain = uniqueSubdomain('outbox');
      const queue = app.get(QueueService);
      const publish = jest.spyOn(queue, 'publish').mockRejectedValueOnce(new Error('broker down'));
      const res = await post(subdomain);
      publish.mockRestore();
      expect(res.status).toBe(202);
      const row = await withControl((c) => c.query('SELECT status, published_at FROM provisioning_jobs WHERE id = $1', [res.body.job_id]));
      expect(row.rows[0]).toEqual({ status: 'QUEUED', published_at: null });

      await app.get(JobsService).sweep();
      expect((await api.waitForJob(token, res.body.job_id)).status).toBe('SUCCEEDED');
    });

    it('E-TEN-06: a job that never reaches a worker ends FAILED once stale, and can be retried', async () => {
      const subdomain = uniqueSubdomain('lost');
      const queue = app.get(QueueService);
      const publish = jest.spyOn(queue, 'publish').mockRejectedValueOnce(new Error('broker down'));
      const res = await post(subdomain);
      publish.mockRestore();
      await withControl((c) =>
        c.query(`UPDATE tenants SET updated_at = now() - interval '20 minutes' WHERE id = $1`, [res.body.tenant.id]),
      );

      const got = await api.call('get', `/platform/api/v1/tenants/${res.body.tenant.id}`, { token });
      expect(got.body).toMatchObject({ status: 'FAILED', failure_reason: expect.stringContaining('interrupted') });
      expect((await api.call('get', `/platform/api/v1/jobs/${res.body.job_id}`, { token })).body.status).toBe('FAILED');

      const retried = await api.call('post', `/platform/api/v1/tenants/${res.body.tenant.id}/retry`, {
        token,
        body: { admin_password: ADMIN_PASSWORD },
      });
      expect((await api.waitForJob(token, retried.body.job_id)).status).toBe('SUCCEEDED');
    });

    it('E-INF-02: a malformed job message is not retried', async () => {
      await expect(Promise.resolve().then(() => parseJobMessage({ jobId: 'nope' }))).rejects.toThrow(NonRetryableError);
      await expect(Promise.resolve().then(() => parseJobMessage(null))).rejects.toThrow(NonRetryableError);
    });

    it('E-TEN-14: HTML and emoji in the name are stored as they are', async () => {
      const subdomain = uniqueSubdomain('html');
      const name = '<script>alert(1)</script> Société 🚀';
      const res = await api.call('post', '/platform/api/v1/tenants', { token, body: { ...body(subdomain), name } });
      expect(res.status).toBe(202);
      await api.waitForJob(token, res.body.job_id);
      expect((await api.call('get', `/platform/api/v1/tenants/${res.body.tenant.id}`, { token })).body.name).toBe(name);
      const tooLong = await api.call('post', '/platform/api/v1/tenants', {
        token,
        body: { ...body(uniqueSubdomain('long')), name: 'x'.repeat(201) },
      });
      expect(tooLong.status).toBe(422);
    });
  });

  describe('Super Admin login', () => {
    const email = `locked-${Date.now()}@platform.test`;

    beforeAll(async () => {
      const hash = await hashPassword('Locked-Admin-2026');
      await withControl((c) =>
        c.query(
          `INSERT INTO platform_admins (id, email, password_hash, role_id, updated_at)
           VALUES (gen_random_uuid(), $1, $2, (SELECT id FROM platform_roles WHERE key = 'PLATFORM_SUPPORT'), now())`,
          [email, hash],
        ),
      );
    });
    afterAll(() => withControl((c) => c.query('DELETE FROM platform_admins WHERE email = $1', [email])));

    it('after 5 failures the right password gets the same 401 as a wrong one (C11, F02 AC-03)', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await api.call('post', '/platform/api/v1/auth/login', { body: { email, password: 'Wrong-Password-1' } });
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('INVALID_CREDENTIALS');
      }
      const locked = await api.call('post', '/platform/api/v1/auth/login', { body: { email, password: 'Locked-Admin-2026' } });
      expect(locked.status).toBe(401);
      expect(locked.body.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
