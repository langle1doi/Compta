import './support/purge-enabled';
import { NestExpressApplication } from '@nestjs/platform-express';
import { TenantExportsService } from '../src/modules/platform/exports/tenant-exports.service';
import { TenantPurgeService } from '../src/modules/platform/exports/tenant-purge.service';
import { StorageService, tenantObjectKey } from '../src/modules/storage/storage.service';
import { Api, createTestApp, hostOf, uniqueSubdomain } from './support/app';
import { tenantDbNameOf, withAdmin, withControl } from './support/db';

describe('Platform: purge of deleted tenants (F01 BR-06)', () => {
  let app: NestExpressApplication;
  let api: Api;
  let token: string;
  const purge = () => app.get(TenantPurgeService);

  const deleted = async (label: string) => {
    const tenant = await api.createTenant(token, uniqueSubdomain(label));
    const confirm_name = `Tenant ${tenant.subdomain}`;
    for (const status of ['SUSPENDED', 'DELETED']) {
      const res = await api.call('patch', `/platform/api/v1/tenants/${tenant.id}/status`, { token, body: { status, confirm_name } });
      expect(res.status).toBe(200);
    }
    return tenant;
  };
  const exported = async (id: string) => {
    const res = await api.call('post', `/platform/api/v1/tenants/${id}/export`, { token });
    expect(res.status).toBe(202);
    expect((await api.waitForJob(token, res.body.job_id)).status).toBe('SUCCEEDED');
  };
  const age = (id: string, days: number) =>
    withControl((c) => c.query(`UPDATE tenants SET deleted_at = now() - $2::interval WHERE id = $1`, [id, `${days} days`]));
  const dbExists = async (name: string) =>
    (await withAdmin((c) => c.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]))).rows.length === 1;
  const rolesLeft = async (name: string) =>
    (await withAdmin((c) => c.query('SELECT 1 FROM pg_roles WHERE rolname = $1 OR rolname = $2', [name, `${name}_app`]))).rows.length;
  const tenantRow = async (id: string) => (await withControl((c) => c.query('SELECT status FROM tenants WHERE id = $1', [id]))).rows[0];

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    token = await api.platformToken();
  });
  afterAll(() => app.close());

  it('BE-F01-11: past 30 days but no export: nothing is dropped', async () => {
    const tenant = await deleted('noexp');
    await age(tenant.id, 31);
    const outcome = await purge().run();
    expect(outcome.skipped).toContain(tenant.subdomain);
    expect(await dbExists(tenantDbNameOf(tenant.subdomain))).toBe(true);
    expect(await tenantRow(tenant.id)).toEqual({ status: 'DELETED' });
  });

  it('not yet 30 days: nothing is dropped, even with an export', async () => {
    const tenant = await deleted('young');
    await exported(tenant.id);
    await age(tenant.id, 29);
    const outcome = await purge().run();
    expect(outcome.purged).not.toContain(tenant.subdomain);
    expect(await dbExists(tenantDbNameOf(tenant.subdomain))).toBe(true);
  });

  it('BE-F01-12, E-EXP-08, E-TEN-10: due with an export: database, roles and files go, the audit log stays, the subdomain is free', async () => {
    const tenant = await deleted('due');
    await exported(tenant.id);
    const storage = app.get(StorageService);
    const file = tenantObjectKey(tenant.id, 'documents/a.txt');
    await storage.putBuffer(file, Buffer.from('x'), 'text/plain');
    await age(tenant.id, 30);

    const name = tenantDbNameOf(tenant.subdomain);
    expect(await rolesLeft(name)).toBe(2);
    const outcome = await purge().run();
    expect(outcome.ran).toBe(true);
    expect(outcome.purged).toContain(tenant.subdomain);

    expect(await dbExists(name)).toBe(false);
    expect(await rolesLeft(name)).toBe(0);
    expect(await storage.exists(file)).toBe(false);
    expect(await storage.tenantUsage(tenant.id)).toBe(0);
    expect(await tenantRow(tenant.id)).toBeUndefined();

    const audit = await withControl((c) =>
      c.query(`SELECT actor_email, before FROM platform_audit_logs WHERE action = 'tenant.purge' AND target_id = $1`, [tenant.id]),
    );
    expect(audit.rows).toEqual([{ actor_email: 'system', before: expect.objectContaining({ subdomain: tenant.subdomain }) }]);

    const again = await api.createTenant(token, tenant.subdomain);
    expect(again.status).toBe('ACTIVE');
  });

  it('BE-F01-12: the zip has long been swept by then: the export still counts, the tenant is purged', async () => {
    const tenant = await deleted('swept');
    await exported(tenant.id);
    await age(tenant.id, 31);
    await withControl((c) =>
      c.query(`UPDATE provisioning_jobs SET finished_at = now() - interval '25 hours' WHERE tenant_id = $1 AND type = 'EXPORT'`, [
        tenant.id,
      ]),
    );
    expect(await app.get(TenantExportsService).deleteExpired()).toBeGreaterThanOrEqual(1);
    expect((await purge().run()).purged).toContain(tenant.subdomain);
  });

  it('BE-F01-11: an export made before the tenant was frozen misses what came after: it does not count', async () => {
    const tenant = await api.createTenant(token, uniqueSubdomain('stale'));
    const adminToken = await api.adminLogin(tenant.subdomain);
    const own = await api.call('post', '/api/v1/tenant/export', { host: hostOf(tenant.subdomain), token: adminToken });
    expect((await api.waitForJob(token, own.body.job_id)).status).toBe('SUCCEEDED');
    const confirm_name = `Tenant ${tenant.subdomain}`;
    for (const status of ['SUSPENDED', 'DELETED']) {
      await api.call('patch', `/platform/api/v1/tenants/${tenant.id}/status`, { token, body: { status, confirm_name } });
    }
    await age(tenant.id, 31);
    expect((await purge().run()).skipped).toContain(tenant.subdomain);
    await exported(tenant.id);
    expect((await purge().run()).purged).toContain(tenant.subdomain);
  });

  it('BE-F01-12: two pods at once: one purges, the other skips the round, one audit row', async () => {
    const tenant = await deleted('pods');
    await exported(tenant.id);
    await age(tenant.id, 31);
    const runs = await Promise.all([purge().run(), purge().run()]);
    expect(runs.filter((r) => r.purged.includes(tenant.subdomain))).toHaveLength(1);
    const audit = await withControl((c) =>
      c.query(`SELECT 1 FROM platform_audit_logs WHERE action = 'tenant.purge' AND target_id = $1`, [tenant.id]),
    );
    expect(audit.rows).toHaveLength(1);
  });

  it('E-EXP-07: a failure midway is logged and the tenant stays for the next round; then it completes', async () => {
    const tenant = await deleted('retry');
    await exported(tenant.id);
    await age(tenant.id, 31);
    const spy = jest.spyOn(app.get(StorageService), 'deletePrefix').mockRejectedValueOnce(new Error('storage down'));
    const first = await purge().run();
    spy.mockRestore();
    expect(first.failed).toContain(tenant.subdomain);
    expect(await tenantRow(tenant.id)).toEqual({ status: 'DELETED' });

    const second = await purge().run();
    expect(second.purged).toContain(tenant.subdomain);
  });

  it('E-EXP-07: only DELETED tenants: an ACTIVE or SUSPENDED one with an old deleted_at is left alone', async () => {
    const tenant = await api.createTenant(token, uniqueSubdomain('back'));
    await withControl((c) => c.query(`UPDATE tenants SET deleted_at = now() - interval '40 days' WHERE id = $1`, [tenant.id]));
    const outcome = await purge().run();
    expect(outcome.purged).not.toContain(tenant.subdomain);
    expect(await dbExists(tenantDbNameOf(tenant.subdomain))).toBe(true);
    await withControl((c) => c.query('UPDATE tenants SET deleted_at = NULL WHERE id = $1', [tenant.id]));
  });

  it('a role owned by a tenant created before the ownership mark is still removed', async () => {
    const tenant = await deleted('legacy');
    await exported(tenant.id);
    await age(tenant.id, 31);
    const name = tenantDbNameOf(tenant.subdomain);
    await withAdmin((c) => c.query(`COMMENT ON ROLE "${name}" IS NULL`));
    expect((await purge().run()).purged).toContain(tenant.subdomain);
    expect(await dbExists(name)).toBe(false);
  });
});
