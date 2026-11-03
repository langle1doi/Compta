import { NestExpressApplication } from '@nestjs/platform-express';
import { JobsService } from '../src/modules/platform/jobs/jobs.service';
import { MigrationsService } from '../src/modules/platform/migrations/migrations.service';
import * as tenantMigrator from '../src/modules/platform/tenants/tenant-migrator';
import { Api, createTestApp, uniqueSubdomain } from './support/app';
import { withControl } from './support/db';

describe('Platform: tenant migrations (F01 AC-06)', () => {
  let app: NestExpressApplication;
  let api: Api;
  let token: string;
  const run = (body: object = {}) => api.call('post', '/platform/api/v1/migrations/run', { token, body });
  const setVersion = (id: string, version: string) =>
    withControl((c) => c.query('UPDATE tenants SET schema_version = $2 WHERE id = $1', [id, version]));
  const version = async (id: string) => (await api.call('get', `/platform/api/v1/tenants/${id}`, { token })).body.schema_version;

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    token = await api.platformToken();
  });
  afterAll(() => app.close());

  it('BE-F01-09, E-MIG-04: one tenant failing does not stop the others; schema_version moves only for those that worked', async () => {
    const [good1, bad, good2] = [
      await api.createTenant(token, uniqueSubdomain('mig1')),
      await api.createTenant(token, uniqueSubdomain('migbad')),
      await api.createTenant(token, uniqueSubdomain('mig2')),
    ];
    for (const t of [good1, bad, good2]) await setVersion(t.id, '20000101000000_old');

    const real = tenantMigrator.migrateTenantDatabase;
    const spy = jest.spyOn(tenantMigrator, 'migrateTenantDatabase').mockImplementation((url) => {
      if (url.includes(bad.subdomain.replace(/-/g, '_'))) return Promise.reject(new Error('secret-host-name unreachable'));
      return real(url);
    });
    const res = await run({ tenant_ids: [good1.id, bad.id, good2.id] });
    expect(res.status).toBe(202);
    const job = await api.waitForJob(token, res.body.job_id);
    spy.mockRestore();

    expect(job.status).toBe('SUCCEEDED');
    expect(job.result).toMatchObject({ succeeded: 2, failed: 1, skipped: 0 });
    const byId = Object.fromEntries(job.result.results.map((r: { tenant_id: string }) => [r.tenant_id, r]));
    const latest = tenantMigrator.latestTenantSchemaVersion();
    expect(byId[good1.id]).toMatchObject({ status: 'SUCCEEDED', schema_version: latest });
    expect(byId[good2.id]).toMatchObject({ status: 'SUCCEEDED', schema_version: latest });
    expect(byId[bad.id]).toMatchObject({ status: 'FAILED', schema_version: '20000101000000_old' });
    // The reason reaches the API: no driver message
    expect(JSON.stringify(job.result)).not.toContain('secret-host-name');

    expect(await version(good1.id)).toBe(latest);
    expect(await version(good2.id)).toBe(latest);
    expect(await version(bad.id)).toBe('20000101000000_old');
    await setVersion(bad.id, latest);
  });

  it('GET /migrations: latest_version, each tenant with is_outdated, filter', async () => {
    const t = await api.createTenant(token, uniqueSubdomain('migview'));
    const latest = tenantMigrator.latestTenantSchemaVersion();
    let res = await api.call('get', '/platform/api/v1/migrations?page_size=100', { token });
    expect(res.status).toBe(200);
    expect(res.body.latest_version).toBe(latest);
    expect(res.body.items.find((i: { tenant: { id: string } }) => i.tenant.id === t.id)).toMatchObject({
      tenant: { subdomain: t.subdomain, status: 'ACTIVE' },
      schema_version: latest,
      is_outdated: false,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/db_?name|db_?user|password/i);

    await setVersion(t.id, '20000101000000_old');
    res = await api.call('get', '/platform/api/v1/migrations?outdated=true&page_size=100', { token });
    expect(res.body.items).toEqual([expect.objectContaining({ tenant: expect.objectContaining({ id: t.id }), is_outdated: true })]);
    expect((await api.call('get', `/platform/api/v1/tenants/${t.id}`, { token })).body.is_outdated).toBe(true);
    await setVersion(t.id, latest);
  });

  it('E-MIG-01: a second run while one is active: 409 JOB_ALREADY_RUNNING', async () => {
    const queue = jest.spyOn(app.get(JobsService), 'publish').mockResolvedValueOnce(undefined);
    const first = await run({ tenant_ids: [] });
    queue.mockRestore();
    expect(first.status).toBe(202);
    const second = await run({ tenant_ids: [] });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('JOB_ALREADY_RUNNING');
    await app.get(MigrationsService).run(first.body.job_id);
    expect((await api.waitForJob(token, first.body.job_id)).status).toBe('SUCCEEDED');
  });

  it('E-MIG-02, E-MIG-06: empty, wrong ids, DELETED, FAILED, PROVISIONING tenants are skipped with a result, never a 500', async () => {
    const empty = await api.waitForJob(token, (await run({ tenant_ids: [] })).body.job_id);
    expect(empty).toMatchObject({ status: 'SUCCEEDED', result: { succeeded: 0, failed: 0, skipped: 0 } });

    const [deleted, failed, provisioning] = [
      await api.createTenant(token, uniqueSubdomain('migdel')),
      await api.createTenant(token, uniqueSubdomain('migfail')),
      await api.createTenant(token, uniqueSubdomain('migprov')),
    ];
    await withControl(async (c) => {
      await c.query(`UPDATE tenants SET status = 'DELETED', deleted_at = now() WHERE id = $1`, [deleted.id]);
      await c.query(`UPDATE tenants SET status = 'FAILED' WHERE id = $1`, [failed.id]);
      await c.query(`UPDATE tenants SET status = 'PROVISIONING' WHERE id = $1`, [provisioning.id]);
    });
    const missing = '00000000-0000-4000-8000-000000000000';
    const res = await run({ tenant_ids: ['not-a-uuid', missing, deleted.id, failed.id, provisioning.id] });
    expect(res.status).toBe(202);
    const job = await api.waitForJob(token, res.body.job_id);
    expect(job).toMatchObject({ status: 'SUCCEEDED', result: { succeeded: 0, failed: 0, skipped: 5 } });
    expect(job.result.results.map((r: { reason: string }) => r.reason).sort()).toEqual([
      'tenant is DELETED',
      'tenant is FAILED',
      'tenant is PROVISIONING',
      'unknown tenant',
      'unknown tenant',
    ]);
    await withControl((c) =>
      c.query(`UPDATE tenants SET status = 'ACTIVE', deleted_at = NULL WHERE id = ANY($1::uuid[])`, [
        [deleted.id, failed.id, provisioning.id],
      ]),
    );
  });

  it('with no tenant_ids, every ACTIVE and SUSPENDED tenant is migrated; nothing to do is a success (E-MIG-06)', async () => {
    const spy = jest
      .spyOn(tenantMigrator, 'migrateTenantDatabase')
      .mockImplementation(() => Promise.resolve(tenantMigrator.latestTenantSchemaVersion()));
    const res = await run();
    const job = await api.waitForJob(token, res.body.job_id, 120_000);
    spy.mockRestore();
    expect(job.status).toBe('SUCCEEDED');
    expect(job.result.failed).toBe(0);
    expect(job.result.succeeded).toBeGreaterThan(0);
  });

  it('E-MIG-03: a tenant created during a run is not missed and not migrated twice: it provisions itself to the latest version', async () => {
    const latest = tenantMigrator.latestTenantSchemaVersion();
    const real = tenantMigrator.migrateTenantDatabase;
    const subdomain = uniqueSubdomain('during');
    const name = subdomain.replace(/-/g, '_');
    let created: { id: string; status: string; schema_version: string } | undefined;
    let ownMigrations = 0;
    const spy = jest.spyOn(tenantMigrator, 'migrateTenantDatabase').mockImplementation(async (url) => {
      if (url.includes(name)) {
        ownMigrations++;
        return real(url);
      }
      // The run has started and read its list of tenants: the new tenant appears now
      if (!created) created = await api.createTenant(token, subdomain);
      return latest;
    });
    const res = await run();
    expect(res.status).toBe(202);
    const job = await api.waitForJob(token, res.body.job_id, 120_000);
    spy.mockRestore();

    expect(job.status).toBe('SUCCEEDED');
    expect(created).toMatchObject({ status: 'ACTIVE', schema_version: latest });
    expect(ownMigrations).toBe(1);
    expect(job.result.results.filter((r: { tenant_id: string }) => r.tenant_id === created!.id)).toEqual([]);
    expect(await version(created!.id)).toBe(latest);

    // And the next run sees it
    const next = await api.waitForJob(token, (await run({ tenant_ids: [created!.id] })).body.job_id);
    expect(next.result).toMatchObject({ succeeded: 1, failed: 0 });
  });

  it('E-MIG-05: a job whose pod was killed does not stay RUNNING: stale jobs fail, and a new run is allowed', async () => {
    const queue = jest.spyOn(app.get(JobsService), 'publish').mockResolvedValueOnce(undefined);
    const res = await run({ tenant_ids: [] });
    queue.mockRestore();
    await withControl((c) =>
      c.query(`UPDATE provisioning_jobs SET status = 'RUNNING', updated_at = now() - interval '31 minutes' WHERE id = $1`, [
        res.body.job_id,
      ]),
    );
    expect((await run({ tenant_ids: [] })).status).toBe(409);
    await app.get(JobsService).sweep();
    expect((await api.call('get', `/platform/api/v1/jobs/${res.body.job_id}`, { token })).body).toMatchObject({
      status: 'FAILED',
      result: { reason: expect.stringContaining('interrupted') },
    });
    const again = await run({ tenant_ids: [] });
    expect(again.status).toBe(202);
    await api.waitForJob(token, again.body.job_id);
  });

  it('E-API-03: target_version is refused: there is no rollback', async () => {
    expect((await run({ target_version: '1' })).status).toBe(422);
  });

  it('audits the run', async () => {
    const res = await run({ tenant_ids: [] });
    await api.waitForJob(token, res.body.job_id);
    const { rows } = await withControl((c) =>
      c.query(`SELECT 1 FROM platform_audit_logs WHERE action = 'migration.run' AND target_id = $1`, [res.body.job_id]),
    );
    expect(rows).toHaveLength(1);
  });
});
