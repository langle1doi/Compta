import './support/storage-down';
import { NestExpressApplication } from '@nestjs/platform-express';
import { StorageService } from '../src/modules/storage/storage.service';
import { Api, createTestApp, hostOf, uniqueSubdomain } from './support/app';
import { withControl } from './support/db';

/** E-EXP-05 and the storage rule of readiness, with an object store that really cannot be reached. */
describe('Platform: object storage unreachable', () => {
  let app: NestExpressApplication;
  let api: Api;
  let token: string;
  let tenant: { id: string; subdomain: string };
  let adminToken: string;
  const exportJobs = async () =>
    (await withControl((c) => c.query(`SELECT 1 FROM provisioning_jobs WHERE tenant_id = $1 AND type = 'EXPORT'`, [tenant.id]))).rows
      .length;

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    token = await api.platformToken();
    tenant = await api.createTenant(token, uniqueSubdomain('nos3'));
    adminToken = await api.adminLogin(tenant.subdomain);
  });
  afterAll(() => app.close());

  it('provisioning, login and the tenant list still work; usage says it does not know', async () => {
    expect(tenant).toMatchObject({ status: 'ACTIVE' });
    const got = await api.call('get', `/platform/api/v1/tenants/${tenant.id}`, { token });
    expect(got.status).toBe(200);
    expect(got.body.usage).toBeNull();
  });

  it('/health/ready stays 200 and says storage is down', async () => {
    const res = await api.call('get', '/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'degraded', components: { control_db: 'up', storage: 'down' } });
  });

  it('asking for an export: tenant route 503 STORAGE_UNAVAILABLE, no job left behind', async () => {
    const res = await api.call('post', '/api/v1/tenant/export', { host: hostOf(tenant.subdomain), token: adminToken });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('STORAGE_UNAVAILABLE');
    expect(await exportJobs()).toBe(0);
  });

  it('asking for an export: platform route 503 STORAGE_UNAVAILABLE on a suspended tenant', async () => {
    const status = await api.call('patch', `/platform/api/v1/tenants/${tenant.id}/status`, {
      token,
      body: { status: 'SUSPENDED', confirm_name: `Tenant ${tenant.subdomain}` },
    });
    expect(status.status).toBe(200);
    const res = await api.call('post', `/platform/api/v1/tenants/${tenant.id}/export`, { token });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('STORAGE_UNAVAILABLE');
    expect(await exportJobs()).toBe(0);
    await api.call('patch', `/platform/api/v1/tenants/${tenant.id}/status`, { token, body: { status: 'ACTIVE' } });
  });

  it('E-EXP-05: storage goes away after the job was accepted: job FAILED with a clear reason, no connection detail, asking again is allowed', async () => {
    const stale = jest.spyOn(app.get(StorageService), 'isAvailable').mockReturnValue(true);
    const res = await api.call('post', '/api/v1/tenant/export', { host: hostOf(tenant.subdomain), token: adminToken });
    expect(res.status).toBe(202);
    const job = await api.waitForJob(token, res.body.job_id);
    expect(job).toMatchObject({ status: 'FAILED', result: { reason: 'file storage is not available, try again' } });
    expect(JSON.stringify(job)).not.toMatch(/localhost|ECONNREFUSED/);

    // The failed job does not block a new one
    const again = await api.call('post', '/api/v1/tenant/export', { host: hostOf(tenant.subdomain), token: adminToken });
    stale.mockRestore();
    expect(again.status).toBe(202);
    expect(again.body.already_running).toBe(false);
    await api.waitForJob(token, again.body.job_id);
  });
});
