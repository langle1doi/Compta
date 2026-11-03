import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { decode } from 'jsonwebtoken';
import { writeTenantExport } from '../src/modules/platform/exports/tenant-export-writer';
import { TenantExportsService } from '../src/modules/platform/exports/tenant-exports.service';
import { TenantPurgeService } from '../src/modules/platform/exports/tenant-purge.service';
import { MailService } from '../src/modules/mail/mail.service';
import { PLATFORM_OPERATOR, PLATFORM_SUPPORT } from '../src/modules/rbac/platform-catalog';
import { PlanLimitsService } from '../src/modules/tenancy/plan-limits.service';
import { TenantRegistryService } from '../src/modules/tenancy/tenant-registry.service';
import { StorageService, tenantObjectKey } from '../src/modules/storage/storage.service';
import { Api, billingAddress, createTestApp, hostOf, uniqueSubdomain, USER_PASSWORD } from './support/app';
import { tenantDbNameOf, withAdmin, withControl, withTenantDb } from './support/db';
import { linkIn, mailsTo, waitForMails } from './support/mailpit';
import { readZip } from './support/zip';

const PASSWORD = 'Platform-Admin-2026';

describe('Platform: invitation, export, support sessions (F01)', () => {
  let app: NestExpressApplication;
  let api: Api;
  let token: string;
  let support: string;
  let operator: string;

  const registry = () => app.get(TenantRegistryService);
  const setStatus = (id: string, sub: string, status: string) =>
    api.call('patch', `/platform/api/v1/tenants/${id}/status`, { token, body: { status, confirm_name: `Tenant ${sub}` } });

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    token = await api.platformToken();
    const roles = (await api.call('get', '/platform/api/v1/roles', { token })).body as { id: string; key: string }[];
    const account = async (key: string) => {
      const email = `${key.toLowerCase()}-exp-${Date.now().toString(36)}@platform.test`;
      const res = await api.call('post', '/platform/api/v1/users', {
        token,
        body: { email, full_name: key, password: PASSWORD, role_id: roles.find((r) => r.key === key)!.id },
      });
      expect(res.status).toBe(201);
      return api.platformToken(email, PASSWORD);
    };
    support = await account(PLATFORM_SUPPORT);
    operator = await account(PLATFORM_OPERATOR);
  });
  afterAll(() => app.close());

  describe('first admin by invitation (AC-01)', () => {
    const create = (subdomain: string) =>
      api.call('post', '/platform/api/v1/tenants', {
        token,
        body: { name: `Tenant ${subdomain}`, subdomain, admin_email: `boss@${subdomain}.test` },
      });
    const acceptUrl = (subdomain: string) => `boss@${subdomain}.test`;

    it('BE-F01-01, BE-F01-02: no password: the invite step runs, the admin gets the mail and sets a password', async () => {
      const subdomain = uniqueSubdomain('inv');
      const startedAt = Date.now();
      const res = await create(subdomain);
      expect(res.status).toBe(202);
      const job = await api.waitForJob(token, res.body.job_id);
      expect(job).toMatchObject({ status: 'SUCCEEDED', result: { invite: { status: 'QUEUED' } } });
      expect(job.steps.map((s: { step: string }) => s.step)).toEqual(['create_database', 'migrate', 'seed', 'invite']);
      expect(job.steps[3].status).toBe('DONE');
      expect(JSON.stringify(job)).not.toMatch(/token=|invite_url/);

      const [mail] = await waitForMails(acceptUrl(subdomain));
      // AC-01: ACTIVE and the admin has the mail within 2 minutes
      expect(Date.now() - startedAt).toBeLessThan(2 * 60 * 1000);
      const link = linkIn(mail);
      expect(link.hostname).toBe(`${subdomain}.compta.test`);
      const accepted = await api.call('post', `/api/v1/auth/invitations/${link.searchParams.get('token')}/accept`, {
        body: { password: USER_PASSWORD },
      });
      expect(accepted.status).toBeLessThan(300);
      await expect(api.login(subdomain, acceptUrl(subdomain), USER_PASSWORD)).resolves.toEqual(expect.any(String));
    });

    it('resend-invite: the old link dies, the new one works; nothing left to send after it is accepted: 409', async () => {
      const subdomain = uniqueSubdomain('resend');
      const res = await create(subdomain);
      await api.waitForJob(token, res.body.job_id);
      const [first] = await waitForMails(acceptUrl(subdomain));

      const resent = await api.call('post', `/platform/api/v1/tenants/${res.body.tenant.id}/resend-invite`, { token });
      expect(resent.status).toBe(200);
      expect(resent.body).toMatchObject({ mail_status: 'QUEUED' });
      expect(resent.body.invite_url).toBeUndefined();
      const mails = await waitForMails(acceptUrl(subdomain), 2);
      const second = mails.find((m) => m.ID !== first.ID)!;

      const old = await api.call('post', `/api/v1/auth/invitations/${linkIn(first).searchParams.get('token')}/accept`, {
        body: { password: USER_PASSWORD },
      });
      expect(old.status).toBeGreaterThanOrEqual(400);
      const ok = await api.call('post', `/api/v1/auth/invitations/${linkIn(second).searchParams.get('token')}/accept`, {
        body: { password: USER_PASSWORD },
      });
      expect(ok.status).toBeLessThan(300);

      const none = await api.call('post', `/platform/api/v1/tenants/${res.body.tenant.id}/resend-invite`, { token });
      expect(none.status).toBe(409);
      expect(none.body.code).toBe('NO_PENDING_INVITE');
    });

    it('BE-F01-30: no mail configured: no failure, resend-invite hands over invite_url, it is not kept or logged in the audit', async () => {
      const subdomain = uniqueSubdomain('nomail');
      const mail = jest
        .spyOn(app.get(MailService), 'enqueue')
        .mockResolvedValue({ mailJobId: '00000000-0000-4000-8000-000000000000', status: 'SKIPPED' });
      try {
        const res = await create(subdomain);
        const job = await api.waitForJob(token, res.body.job_id);
        expect(job).toMatchObject({ status: 'SUCCEEDED', result: { invite: { status: 'SKIPPED' } } });

        const resent = await api.call('post', `/platform/api/v1/tenants/${res.body.tenant.id}/resend-invite`, { token });
        expect(resent.status).toBe(200);
        expect(resent.body).toMatchObject({ mail_status: 'SKIPPED', invite_url: expect.stringContaining('token=') });

        const audit = await withControl((c) =>
          c.query(`SELECT after FROM platform_audit_logs WHERE action = 'tenant.resend_invite' AND target_id = $1`, [res.body.tenant.id]),
        );
        expect(JSON.stringify(audit.rows)).not.toContain('token=');
        const jobRow = await withControl((c) => c.query('SELECT result::text FROM provisioning_jobs WHERE id = $1', [res.body.job_id]));
        expect(jobRow.rows[0].result).not.toContain('token=');
      } finally {
        mail.mockRestore();
      }
    });

    it('E-TEN-08: the invitation fails: the tenant is still ACTIVE, the failure is recorded, sending again works', async () => {
      const subdomain = uniqueSubdomain('mailfail');
      const mail = jest.spyOn(app.get(MailService), 'enqueue').mockRejectedValueOnce(new Error('smtp down'));
      const res = await create(subdomain);
      const job = await api.waitForJob(token, res.body.job_id);
      mail.mockRestore();
      expect(job).toMatchObject({ status: 'SUCCEEDED', result: { invite: { status: 'FAILED' } } });
      expect(job.steps[3]).toMatchObject({ step: 'invite', status: 'FAILED' });
      expect((await api.call('get', `/platform/api/v1/tenants/${res.body.tenant.id}`, { token })).body.status).toBe('ACTIVE');
      expect((await api.call('post', `/platform/api/v1/tenants/${res.body.tenant.id}/resend-invite`, { token })).status).toBe(200);
      await waitForMails(acceptUrl(subdomain));
    });

    it('E-TEN-07: a redelivery after the invitation went out sends no second mail', async () => {
      const subdomain = uniqueSubdomain('once');
      const res = await create(subdomain);
      await api.waitForJob(token, res.body.job_id);
      await waitForMails(acceptUrl(subdomain));
      await withControl(async (c) => {
        await c.query(`UPDATE provisioning_jobs SET status = 'RUNNING', finished_at = NULL WHERE id = $1`, [res.body.job_id]);
        await c.query(`UPDATE tenants SET provisioning_input = $2 WHERE id = $1`, [
          res.body.tenant.id,
          JSON.stringify({ adminEmail: acceptUrl(subdomain) }),
        ]);
      });
      const { TenantProvisioningService } = await import('../src/modules/platform/tenants/tenant-provisioning.service');
      await app.get(TenantProvisioningService).run(res.body.job_id);
      await new Promise((r) => setTimeout(r, 1000));
      expect(await mailsTo(acceptUrl(subdomain))).toHaveLength(1);
    });

    it('a tenant created with a password has nothing to resend, and Support cannot resend', async () => {
      const tenant = await api.createTenant(token, uniqueSubdomain('pwd'));
      expect((await api.call('post', `/platform/api/v1/tenants/${tenant.id}/resend-invite`, { token })).status).toBe(409);
      expect((await api.call('post', `/platform/api/v1/tenants/${tenant.id}/resend-invite`, { token: support })).status).toBe(403);
    });
  });

  describe('BE-F01-13: export', () => {
    let tenant: { id: string; subdomain: string };
    let adminToken: string;
    const host = () => hostOf(tenant.subdomain);
    const exportsUrl = () => `/platform/api/v1/tenants/${tenant.id}/export`;
    const zipOf = async (url: string) => {
      const res = await fetch(url);
      expect(res.status).toBe(200);
      return readZip(Buffer.from(await res.arrayBuffer()));
    };

    beforeAll(async () => {
      tenant = await api.createTenant(token, uniqueSubdomain('exp'));
      adminToken = await api.adminLogin(tenant.subdomain);
      const companies = await api.call('get', '/api/v1/companies', { host: host(), token: adminToken });
      const created = await api.call('post', '/api/v1/customers', {
        host: host(),
        token: adminToken,
        company: companies.body[0].id,
        body: { type: 'COMPANY', name: 'Exported Customer', addresses: [billingAddress] },
      });
      expect(created.status).toBe(201);
    });

    it('AC-07: only a SUSPENDED or DELETED tenant through the platform: 409 otherwise; Operator and Support refused', async () => {
      const res = await api.call('post', exportsUrl(), { token });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('TENANT_NOT_EXPORTABLE');
      expect((await api.call('post', exportsUrl(), { token: operator })).status).toBe(403);
      expect((await api.call('post', exportsUrl(), { token: support })).status).toBe(403);
    });

    it('US-05: the tenant admin exports: background job, zip with the data, link for 24 hours, mail with the link', async () => {
      const res = await api.call('post', '/api/v1/tenant/export', { host: host(), token: adminToken });
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ job_id: expect.any(String), already_running: false });
      const job = await api.waitForJob(token, res.body.job_id);
      expect(job).toMatchObject({ status: 'SUCCEEDED', type: 'EXPORT', tenant_id: tenant.id });

      const view = await api.call('get', `/api/v1/tenant/export/${res.body.job_id}`, { host: host(), token: adminToken });
      expect(view.status).toBe(200);
      expect(view.body).toMatchObject({ status: 'SUCCEEDED', expired: false, download_url: expect.stringContaining('X-Amz-Signature') });
      const expiresIn = Number(new URL(view.body.download_url).searchParams.get('X-Amz-Expires'));
      expect(expiresIn).toBeGreaterThan(24 * 3600 - 60);
      expect(expiresIn).toBeLessThanOrEqual(24 * 3600);

      const entries = await zipOf(view.body.download_url);
      expect(entries['customers.ndjson']).toContain('Exported Customer');
      expect(entries['users.ndjson']).toContain(`admin@${tenant.subdomain}.test`);
      expect(JSON.parse(entries['manifest.json']).tables).toEqual(
        expect.arrayContaining([expect.objectContaining({ table: 'customers', rows: 1 })]),
      );

      const [mail] = await waitForMails(`admin@${tenant.subdomain}.test`);
      expect(mail.Text).toContain('X-Amz-Signature');
    });

    it('E-EXP-01: no password hash, 2FA secret, token, recovery code, secret anywhere in the zip', async () => {
      // A user with a session, a refresh token, a reset and 2FA data, so that these tables have rows to leak
      await api.adminLogin(tenant.subdomain);
      const secrets = await withTenantDb(tenant.subdomain, async (db) => {
        const user = (await db.query<{ id: string; password_hash: string }>('SELECT id, password_hash FROM users LIMIT 1')).rows[0];
        await db
          .query(
            `INSERT INTO user_mfa (id, user_id, totp_secret_enc, updated_at) VALUES (gen_random_uuid(), $1, 'TOTPSECRETVALUE', now()) ON CONFLICT DO NOTHING`,
            [user.id],
          )
          .catch(() => undefined);
        await db
          .query(`INSERT INTO mfa_recovery_codes (id, user_id, code_hash) VALUES (gen_random_uuid(), $1, 'RECOVERYHASHVALUE')`, [user.id])
          .catch(() => undefined);
        const refresh = (await db.query<{ token_hash: string }>('SELECT token_hash FROM refresh_tokens LIMIT 1')).rows[0];
        return { hash: user.password_hash, refresh: refresh?.token_hash };
      });
      expect(secrets.hash).toMatch(/^\$argon2/);
      expect(secrets.refresh).toBeTruthy();

      const res = await api.call('post', '/api/v1/tenant/export', { host: host(), token: adminToken });
      await api.waitForJob(token, res.body.job_id);
      const view = await api.call('get', `/api/v1/tenant/export/${res.body.job_id}`, { host: host(), token: adminToken });
      const entries = await zipOf(view.body.download_url);

      const everything = Object.values(entries).join('\n');
      expect(everything).not.toMatch(/\$argon2/);
      expect(everything).not.toContain(secrets.hash);
      expect(everything).not.toContain(secrets.refresh);
      expect(everything).not.toContain('TOTPSECRETVALUE');
      expect(everything).not.toContain('RECOVERYHASHVALUE');
      expect(everything).not.toMatch(/"(password_hash|token_hash|code_hash|totp_secret_enc|public_token|token_version)"/);
      for (const table of [
        'sessions',
        'refresh_tokens',
        'password_resets',
        'invitations',
        'user_mfa',
        'mfa_recovery_codes',
        'idempotency_keys',
        '_prisma_migrations',
      ]) {
        expect(Object.keys(entries)).not.toContain(`${table}.ndjson`);
      }
    });

    it('E-EXP-03: what changes during an export is not in it: one read-only snapshot across all tables', async () => {
      const row = (await registry().findById(tenant.id))!;
      const company = (await api.call('get', '/api/v1/companies', { host: host(), token: adminToken })).body[0].id;
      const dir = await mkdtemp(join(tmpdir(), 'export-test-'));
      const changed: string[] = [];
      try {
        // After the first table the snapshot is taken: this customer exists before "customers" is read, in a later query
        const tables = await writeTenantExport(registry().ownerConnectionString(row), dir, join(dir, 'out.zip'), async (table) => {
          if (changed.length > 0) return;
          changed.push(table);
          const res = await api.call('post', '/api/v1/customers', {
            host: host(),
            token: adminToken,
            company,
            body: { type: 'COMPANY', name: 'Added During Export', addresses: [billingAddress] },
          });
          expect(res.status).toBe(201);
        });
        expect(changed[0] < 'customers').toBe(true);
        expect(tables.map((t) => t.table)).toContain('customers');

        const inDb = await withTenantDb(tenant.subdomain, (db) => db.query(`SELECT 1 FROM customers WHERE name = 'Added During Export'`));
        expect(inDb.rows).toHaveLength(1);
        const entries = readZip(await readFile(join(dir, 'out.zip')));
        expect(entries['customers.ndjson']).toContain('Exported Customer');
        expect(entries['customers.ndjson']).not.toContain('Added During Export');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('E-EXP-02: more rows than one cursor batch all arrive, line by line; each table reports progress so the job is not stale', async () => {
      const big = await api.createTenant(token, uniqueSubdomain('big'));
      const ROWS = 2500;
      await withTenantDb(big.subdomain, (db) =>
        db.query(
          `INSERT INTO customers (id, company_id, code, type, name, owner_id, updated_at)
           SELECT gen_random_uuid(), (SELECT id FROM companies LIMIT 1), 'BULK' || g, 'COMPANY', 'Bulk ' || g, (SELECT id FROM users LIMIT 1), now()
           FROM generate_series(1, $1::int) g`,
          [ROWS],
        ),
      );
      const row = (await registry().findById(big.id))!;
      const dir = await mkdtemp(join(tmpdir(), 'export-test-'));
      try {
        const progress: string[] = [];
        const tables = await writeTenantExport(registry().ownerConnectionString(row), dir, join(dir, 'out.zip'), (table) => {
          progress.push(table);
          return Promise.resolve();
        });
        expect(tables.find((t) => t.table === 'customers')!.rows).toBe(ROWS);
        expect(progress).toEqual(tables.map((t) => t.table));
        const lines = readZip(await readFile(join(dir, 'out.zip')))
          ['customers.ndjson'].trim()
          .split('\n');
        expect(lines).toHaveLength(ROWS);
        expect(JSON.parse(lines[0]).name).toMatch(/^Bulk \d+$/);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('an export removes its zip from storage once the link has expired; a job still in its 24 hours keeps it', async () => {
      const exports = app.get(TenantExportsService);
      const storage = app.get(StorageService);
      const res = await api.call('post', '/api/v1/tenant/export', { host: host(), token: adminToken });
      await api.waitForJob(token, res.body.job_id);
      const key = tenantObjectKey(tenant.id, `exports/${res.body.job_id}.zip`);
      expect(await storage.exists(key)).toBe(true);

      await exports.deleteExpired();
      expect(await storage.exists(key)).toBe(true);

      await withControl((c) =>
        c.query(`UPDATE provisioning_jobs SET finished_at = now() - interval '25 hours' WHERE id = $1`, [res.body.job_id]),
      );
      expect(await exports.deleteExpired()).toBeGreaterThanOrEqual(1);
      expect(await storage.exists(key)).toBe(false);
      expect(await exports.deleteExpired()).toBe(0);
      const row = await withControl((c) => c.query('SELECT file_deleted_at FROM provisioning_jobs WHERE id = $1', [res.body.job_id]));
      expect(row.rows[0].file_deleted_at).not.toBeNull();
    });

    it('a zip left by a failed job goes too; storage down: retried next round, never an exception', async () => {
      const exports = app.get(TenantExportsService);
      const storage = app.get(StorageService);
      const res = await api.call('post', '/api/v1/tenant/export', { host: host(), token: adminToken });
      await api.waitForJob(token, res.body.job_id);
      const key = tenantObjectKey(tenant.id, `exports/${res.body.job_id}.zip`);
      await withControl((c) =>
        c.query(`UPDATE provisioning_jobs SET status = 'FAILED', finished_at = now() - interval '25 hours' WHERE id = $1`, [
          res.body.job_id,
        ]),
      );

      const down = jest.spyOn(storage, 'delete').mockRejectedValueOnce(new Error('storage down'));
      expect(await exports.deleteExpired()).toBe(0);
      down.mockRestore();
      expect(await storage.exists(key)).toBe(true);

      expect(await exports.deleteExpired()).toBe(1);
      expect(await storage.exists(key)).toBe(false);
    });

    it('E-EXP-04: asking twice gives the running job, not a second one', async () => {
      const publish = jest
        .spyOn(
          (app.get(TenantRegistryService) as never as Record<string, never>) &&
            (await import('../src/modules/platform/jobs/jobs.service')).JobsService.prototype,
          'publish',
        )
        .mockResolvedValue(undefined);
      const first = await api.call('post', '/api/v1/tenant/export', { host: host(), token: adminToken });
      const second = await api.call('post', '/api/v1/tenant/export', { host: host(), token: adminToken });
      publish.mockRestore();
      expect(second.status).toBe(202);
      expect(second.body).toEqual({ job_id: first.body.job_id, already_running: true });
      const { TenantExportsService } = await import('../src/modules/platform/exports/tenant-exports.service');
      await app.get(TenantExportsService).run(first.body.job_id);
    });

    it('E-EXP-05: storage down: job FAILED with no detail, asking again works', async () => {
      const put = jest.spyOn(app.get(StorageService), 'putFile').mockRejectedValueOnce(new Error('minio-secret-host down'));
      const res = await api.call('post', '/api/v1/tenant/export', { host: host(), token: adminToken });
      const job = await api.waitForJob(token, res.body.job_id);
      put.mockRestore();
      expect(job).toMatchObject({ status: 'FAILED' });
      expect(JSON.stringify(job)).not.toContain('minio-secret-host');
      const again = await api.call('post', '/api/v1/tenant/export', { host: host(), token: adminToken });
      expect((await api.waitForJob(token, again.body.job_id)).status).toBe('SUCCEEDED');
    });

    it('E-EXP-06: another tenant, a guessed path, a changed signature, an expired link: all refused', async () => {
      const res = await api.call('post', '/api/v1/tenant/export', { host: host(), token: adminToken });
      await api.waitForJob(token, res.body.job_id);
      const view = await api.call('get', `/api/v1/tenant/export/${res.body.job_id}`, { host: host(), token: adminToken });

      const other = await api.createTenant(token, uniqueSubdomain('other'));
      const otherToken = await api.adminLogin(other.subdomain);
      expect(
        (await api.call('get', `/api/v1/tenant/export/${res.body.job_id}`, { host: hostOf(other.subdomain), token: otherToken })).status,
      ).toBe(404);
      expect((await api.call('get', `/platform/api/v1/tenants/${other.id}/export/${res.body.job_id}`, { token })).status).toBe(404);

      const url = new URL(view.body.download_url);
      expect((await fetch(`${url.origin}${url.pathname}`)).status).toBe(403);
      const tampered = new URL(url);
      tampered.searchParams.set('X-Amz-Signature', '0'.repeat(64));
      expect((await fetch(tampered)).status).toBe(403);

      const key = tenantObjectKey(tenant.id, `exports/${res.body.job_id}.zip`);
      const short = await app.get(StorageService).presignedDownloadUrl(key, 1);
      await new Promise((r) => setTimeout(r, 2500));
      expect((await fetch(short)).status).toBe(403);

      await withControl((c) =>
        c.query(
          `UPDATE provisioning_jobs SET result = jsonb_set(result, '{expiresAt}', to_jsonb((now() - interval '1 minute')::text)) WHERE id = $1`,
          [res.body.job_id],
        ),
      );
      const expired = await api.call('get', `/api/v1/tenant/export/${res.body.job_id}`, { host: host(), token: adminToken });
      expect(expired.body).toMatchObject({ expired: true, download_url: null });
    });

    it('E-EXP-02: an almost empty tenant exports fine; a SUSPENDED one through the platform, audited, link only for who may export', async () => {
      const empty = await api.createTenant(token, uniqueSubdomain('empty'));
      expect((await setStatus(empty.id, empty.subdomain, 'SUSPENDED')).status).toBe(200);
      const url = `/platform/api/v1/tenants/${empty.id}/export`;
      const res = await api.call('post', url, { token });
      expect(res.status).toBe(202);
      const job = await api.waitForJob(token, res.body.job_id);
      expect(job.status).toBe('SUCCEEDED');
      expect(JSON.stringify(job)).not.toMatch(/X-Amz|download_url/);

      const view = await api.call('get', `${url}/${res.body.job_id}`, { token });
      expect(view.body.download_url).toEqual(expect.any(String));
      expect((await api.call('get', `${url}/${res.body.job_id}`, { token: support })).status).toBe(403);
      expect((await api.call('get', url, { token })).body).toHaveLength(1);

      const entries = await zipOf(view.body.download_url);
      expect(entries['customers.ndjson']).toBe('');
      const audit = await withControl((c) =>
        c.query(`SELECT action FROM platform_audit_logs WHERE target_id = $1 AND action LIKE 'tenant.export%' ORDER BY id`, [empty.id]),
      );
      expect(audit.rows.map((r) => r.action)).toEqual(['tenant.export', 'tenant.export_link']);
      const [mail] = await waitForMails('superadmin@platform.local');
      expect(mail.Text).toContain('X-Amz-Signature');
    });

    it('a user without settings.manage cannot export', async () => {
      const dfmSales = await api.login('dfm', 'sales@dfm.local', '123456');
      expect((await api.call('post', '/api/v1/tenant/export', { host: hostOf('dfm'), token: dfmSales })).status).toBe(403);
    });

    it('BE-F01-11: with TENANT_PURGE_ENABLED off the purge job does nothing at all', async () => {
      const gone = await api.createTenant(token, uniqueSubdomain('off'));
      await setStatus(gone.id, gone.subdomain, 'SUSPENDED');
      await setStatus(gone.id, gone.subdomain, 'DELETED');
      await withControl((c) => c.query(`UPDATE tenants SET deleted_at = now() - interval '40 days' WHERE id = $1`, [gone.id]));
      expect(await app.get(TenantPurgeService).run()).toEqual({ ran: false, purged: [], skipped: [], failed: [] });
      const db = await withAdmin((c) => c.query('SELECT 1 FROM pg_database WHERE datname = $1', [tenantDbNameOf(gone.subdomain)]));
      expect(db.rows).toHaveLength(1);
    });
  });

  describe('BE-F01-08: storage limit', () => {
    it('adding beyond max_storage_gb: 402 PLAN_LIMIT_REACHED; exports do not count', async () => {
      const tenant = await api.createTenant(token, uniqueSubdomain('quota'));
      const row = (await withControl((c) => c.query('SELECT * FROM tenants WHERE id = $1', [tenant.id]))).rows[0];
      const registry = app.get(TenantRegistryService);
      const limits = app.get(PlanLimitsService);
      const storage = app.get(StorageService);
      const context = await registry.findById(row.id);
      await storage.putBuffer(tenantObjectKey(tenant.id, 'documents/a.bin'), Buffer.alloc(1024), 'application/octet-stream');
      await storage.putBuffer(tenantObjectKey(tenant.id, 'exports/x.zip'), Buffer.alloc(4096), 'application/zip');
      expect(await storage.tenantUsage(tenant.id)).toBe(1024);

      const plan = await limits.plan(context!.planId);
      const max = plan.maxStorageGb * 1024 ** 3;
      await registry.runIn(context!, async () => {
        // The limit covers the database too. Its size moves a little by itself, so the margin is what is checked
        const [{ size }] = await registry.clientFor(context!).$queryRaw<
          { size: bigint }[]
        >`SELECT pg_database_size(current_database()) AS size`;
        const used = Number(size) + 1024;
        await expect(limits.assertStorageFits(max - used - 1024 * 1024)).resolves.toBeUndefined();
        await expect(limits.assertStorageFits(max - used + 1024 * 1024)).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
      });
    });
  });

  describe('BE-F01-26, BE-F01-27, BE-F01-28: support sessions (BR-05)', () => {
    let tenant: { id: string; subdomain: string };
    let adminToken: string;
    const host = () => hostOf(tenant.subdomain);
    const grant = (body: object, as = adminToken, h = host()) => api.call('post', '/api/v1/support-sessions', { host: h, token: as, body });
    const enter = (id = tenant.id, as = token) => api.call('post', `/platform/api/v1/tenants/${id}/support-sessions/enter`, { token: as });
    const revokeAll = async () => {
      const list = await api.call('get', '/api/v1/support-sessions', { host: host(), token: adminToken });
      for (const s of list.body)
        if (!s.revoked_at) await api.call('delete', `/api/v1/support-sessions/${s.id}`, { host: host(), token: adminToken });
    };

    beforeAll(async () => {
      tenant = await api.createTenant(token, uniqueSubdomain('sup'));
      adminToken = await api.adminLogin(tenant.subdomain);
    });
    afterEach(() => revokeAll());

    it('BE-F01-28: without a session a Super Admin reads nothing of a tenant: no token, platform token refused on tenant routes', async () => {
      const res = await enter();
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUPPORT_SESSION_INVALID');
      for (const path of ['/api/v1/customers', '/api/v1/users', '/api/v1/roles']) {
        expect((await api.call('get', path, { host: host(), token })).status).toBe(401);
      }
    });

    it('E-PLAT-04: duration over 24 h, 0, negative, not a number: 422; a second grant while one is open: 409', async () => {
      for (const duration_hours of [25, 0, -1, 1.5, 'x']) expect((await grant({ duration_hours })).status).toBe(422);
      expect((await grant({})).status).toBe(422);
      const first = await grant({ duration_hours: 2, reason: 'ticket 42' });
      expect(first.status).toBe(201);
      expect(new Date(first.body.expires_at).getTime() - new Date(first.body.created_at).getTime()).toBe(2 * 3_600_000);
      const dup = await grant({ duration_hours: 1 });
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('SUPPORT_SESSION_ACTIVE');
    });

    it('the database itself refuses more than 24 hours', async () => {
      await expect(
        withControl((c) =>
          c.query(
            `INSERT INTO support_sessions (id, tenant_id, granted_by_id, granted_by_email, expires_at, created_at)
             VALUES (gen_random_uuid(), $1, gen_random_uuid(), 'x@y.z', now() + interval '25 hours', now())`,
            [tenant.id],
          ),
        ),
      ).rejects.toThrow(/support_sessions_max_24h_check/);
    });

    it('E-PLAT-04: only someone with settings.manage at tenant level can grant', async () => {
      const dfmOwner = await api.login('dfm', 'owner@dfm.local', '123456');
      const dfmSales = await api.login('dfm', 'sales@dfm.local', '123456');
      expect((await grant({ duration_hours: 1 }, dfmSales, hostOf('dfm'))).status).toBe(403);
      expect([403]).toContain((await grant({ duration_hours: 1 }, dfmOwner, hostOf('dfm'))).status);
    });

    it('BE-F01-26: granted: the Super Admin enters and reads; Operator and Support cannot enter', async () => {
      expect((await grant({ duration_hours: 1 })).status).toBe(201);
      expect((await enter(tenant.id, operator)).status).toBe(403);
      expect((await enter(tenant.id, support)).status).toBe(403);

      const entered = await enter();
      expect(entered.status).toBe(201);
      expect(entered.body).toMatchObject({ token_type: 'Bearer', tenant: { id: tenant.id }, session: { id: expect.any(String) } });
      const read = await api.call('get', '/api/v1/users', { host: host(), token: entered.body.access_token });
      expect(read.status).toBe(200);
    });

    it('a support session is read-only; profile routes and the data export are closed', async () => {
      await grant({ duration_hours: 1 });
      const { access_token } = (await enter()).body;
      const as = (method: 'post' | 'get', path: string, body?: object) =>
        api.call(method, path, { host: host(), token: access_token, body });
      const write = await as('post', '/api/v1/customers', { type: 'COMPANY', name: 'No', addresses: [billingAddress] });
      expect(write.status).toBe(403);
      expect(write.body.code).toBe('SUPPORT_READ_ONLY');
      expect((await as('get', '/api/v1/auth/me')).status).toBe(403);
      expect((await as('get', '/api/v1/me')).status).toBe(403);
      expect((await as('get', '/api/v1/tenant/export')).status).toBe(403);
    });

    it('FE-F01-15: a session lists the companies, so the tenant screens can select one and read through it; it cannot create one', async () => {
      await grant({ duration_hours: 1 });
      const { access_token } = (await enter()).body;
      const companies = await api.call('get', '/api/v1/companies', { host: host(), token: access_token });
      expect(companies.status).toBe(200);
      expect(companies.body.length).toBeGreaterThan(0);
      const read = await api.call('get', '/api/v1/customers', { host: host(), token: access_token, company: companies.body[0].id });
      expect(read.status).toBe(200);
      const write = await api.call('post', '/api/v1/companies', { host: host(), token: access_token, body: { legal_name: 'No' } });
      expect(write.status).toBe(403);
      expect(write.body.code).toBe('SUPPORT_READ_ONLY');
    });

    it('the token lives as long as the session, no longer: expires_in matches, and it dies with the session', async () => {
      const granted = await grant({ duration_hours: 3 });
      const res = await enter();
      expect(res.body.expires_in).toBeGreaterThan(3 * 3600 - 60);
      expect(res.body.expires_in).toBeLessThanOrEqual(3 * 3600);
      const { exp } = decode(res.body.access_token) as { exp: number };
      expect(Math.abs(exp * 1000 - new Date(granted.body.expires_at).getTime())).toBeLessThan(2000);
    });

    it('E-PLAT-02: an admin who loses the right is out at the next request, however long the token still lives', async () => {
      await grant({ duration_hours: 1 });
      const roles = (await api.call('get', '/platform/api/v1/roles', { token })).body as { id: string; key: string }[];
      const roleId = (key: string) => roles.find((r) => r.key === key)!.id;
      const email = `demoted-${Date.now().toString(36)}@platform.test`;
      const created = await api.call('post', '/platform/api/v1/users', {
        token,
        body: { email, full_name: 'D', password: PASSWORD, role_id: roleId('PLATFORM_SUPER_ADMIN') },
      });
      const entered = (await enter(tenant.id, await api.platformToken(email, PASSWORD))).body.access_token;
      expect((await api.call('get', '/api/v1/users', { host: host(), token: entered })).status).toBe(200);
      await api.call('patch', `/platform/api/v1/users/${created.body.id}`, { token, body: { role_id: roleId(PLATFORM_SUPPORT) } });
      expect((await api.call('get', '/api/v1/users', { host: host(), token: entered })).status).toBe(401);
    });

    it('BE-F01-27: what happens in a session is audited on both sides', async () => {
      const granted = await grant({ duration_hours: 1 });
      const { access_token } = (await enter()).body;
      expect((await api.call('get', '/api/v1/users', { host: host(), token: access_token })).status).toBe(200);

      const platform = await withControl((c) =>
        c.query(`SELECT action, actor_email, after FROM platform_audit_logs WHERE target_id = $1 AND action LIKE 'support.%' ORDER BY id`, [
          tenant.id,
        ]),
      );
      const actions = platform.rows.map((r) => r.action);
      expect(actions).toEqual(expect.arrayContaining(['support.grant', 'support.enter', 'support.request']));
      expect(platform.rows.find((r) => r.action === 'support.request' && r.after.sessionId === granted.body.id)).toMatchObject({
        actor_email: 'superadmin@platform.local',
        after: { method: 'GET' },
      });

      const inTenant = await withTenantDb(tenant.subdomain, (db) =>
        db.query(
          `SELECT action, actor_type, actor_email FROM audit_logs WHERE actor_type = 'support' OR action LIKE 'support.%' ORDER BY id`,
        ),
      );
      const tenantActions = inTenant.rows.map((r) => r.action);
      expect(tenantActions).toEqual(expect.arrayContaining(['support.grant', 'support.enter']));
      expect(
        inTenant.rows.some((r) => r.actor_type === 'support' && r.actor_email === 'superadmin@platform.local' && /read/.test(r.action)),
      ).toBe(true);
    });

    it('E-PLAT-05: revoked or expired: the next request is refused at once, with the same token', async () => {
      const granted = await grant({ duration_hours: 1 });
      const { access_token } = (await enter()).body;
      const read = () => api.call('get', '/api/v1/users', { host: host(), token: access_token });
      expect((await read()).status).toBe(200);
      expect((await api.call('delete', `/api/v1/support-sessions/${granted.body.id}`, { host: host(), token: adminToken })).status).toBe(
        200,
      );
      const refused = await read();
      expect(refused.status).toBe(401);
      expect(refused.body.code).toBe('SUPPORT_SESSION_INVALID');
      expect((await enter()).status).toBe(403);
      // Revoking twice is fine
      expect((await api.call('delete', `/api/v1/support-sessions/${granted.body.id}`, { host: host(), token: adminToken })).status).toBe(
        200,
      );

      const again = await grant({ duration_hours: 1 });
      const second = (await enter()).body.access_token;
      await withControl((c) =>
        c.query(`UPDATE support_sessions SET expires_at = created_at + interval '1 millisecond' WHERE id = $1`, [again.body.id]),
      );
      expect((await api.call('get', '/api/v1/users', { host: host(), token: second })).status).toBe(401);
      expect((await enter()).status).toBe(403);
    });

    it('E-PLAT-07: a token of this tenant on another tenant: 401 WRONG_TENANT; a session of another tenant cannot be revoked', async () => {
      const granted = await grant({ duration_hours: 1 });
      const { access_token } = (await enter()).body;
      const other = await api.createTenant(token, uniqueSubdomain('supb'));
      const otherAdmin = await api.adminLogin(other.subdomain);
      const res = await api.call('get', '/api/v1/users', { host: hostOf(other.subdomain), token: access_token });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('WRONG_TENANT');
      expect(
        (await api.call('delete', `/api/v1/support-sessions/${granted.body.id}`, { host: hostOf(other.subdomain), token: otherAdmin }))
          .status,
      ).toBe(404);
      expect((await enter(other.id)).status).toBe(403);
    });

    it('E-PLAT-06: tenant suspended: support is shut out with everyone else, and back on reactivation; Super Admin disabled: out', async () => {
      await grant({ duration_hours: 1 });
      const { access_token } = (await enter()).body;
      const read = () => api.call('get', '/api/v1/users', { host: host(), token: access_token });
      expect((await setStatus(tenant.id, tenant.subdomain, 'SUSPENDED')).status).toBe(200);
      const blocked = await read();
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('TENANT_SUSPENDED');
      expect((await enter()).status).toBe(409);
      expect((await api.call('patch', `/platform/api/v1/tenants/${tenant.id}/status`, { token, body: { status: 'ACTIVE' } })).status).toBe(
        200,
      );
      expect((await read()).status).toBe(200);

      // Second Super Admin in the session, then disabled
      const roles = (await api.call('get', '/platform/api/v1/roles', { token })).body as { id: string; key: string }[];
      const email = `sa2-${Date.now().toString(36)}@platform.test`;
      const created = await api.call('post', '/platform/api/v1/users', {
        token,
        body: { email, full_name: 'SA2', password: PASSWORD, role_id: roles.find((r) => r.key === 'PLATFORM_SUPER_ADMIN')!.id },
      });
      const sa2 = await api.platformToken(email, PASSWORD);
      const hisToken = (await enter(tenant.id, sa2)).body.access_token;
      expect((await api.call('get', '/api/v1/users', { host: host(), token: hisToken })).status).toBe(200);
      await api.call('patch', `/platform/api/v1/users/${created.body.id}/status`, { token, body: { status: 'DISABLED' } });
      expect((await api.call('get', '/api/v1/users', { host: host(), token: hisToken })).status).toBe(401);
    });

    it('the support token is refused on platform routes; a tenant token cannot enter', async () => {
      await grant({ duration_hours: 1 });
      const { access_token } = (await enter()).body;
      expect((await api.call('get', '/platform/api/v1/tenants', { token: access_token })).status).toBe(401);
      expect((await enter(tenant.id, adminToken)).status).toBe(401);
    });
  });
});
