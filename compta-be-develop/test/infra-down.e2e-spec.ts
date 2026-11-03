import './support/services-down';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ControlPrismaService } from '../src/database/control-prisma.service';
import { MailService } from '../src/modules/mail/mail.service';
import { AppException } from '../src/common/errors/app.exception';
import { DEFAULT_PASSWORD } from '../src/modules/platform/tenants/default-accounts';
import { StorageService, tenantObjectKey } from '../src/modules/storage/storage.service';
import { Api, billingAddress, createTestApp, hostOf } from './support/app';

describe('Broker and storage down at startup', () => {
  let app: NestExpressApplication;
  let api: Api;

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
  });
  afterAll(() => app.close());

  it('E-INF-01 the app starts anyway and stays in the load balancer: ready is 200, degraded, naming what is down', async () => {
    expect((await api.call('get', '/health/live')).status).toBe(200);
    const ready = await api.call('get', '/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: 'degraded', components: { control_db: 'up', broker: 'down', storage: 'down' } });
    expect(JSON.stringify(ready.body)).not.toContain('secret-broker-password');
  });

  it('E-INF-01 the metrics say so, for alerts', async () => {
    const metrics = await api.call('get', '/metrics', { headers: { Authorization: `Bearer ${process.env.METRICS_TOKEN}` } });
    expect(metrics.text).toContain('broker_connected 0');
    expect(metrics.text).toContain('storage_reachable 0');
  });

  it('E-INF-01 features that need neither keep working: login, reading and writing data, inviting (the mail waits)', async () => {
    const host = hostOf('dfm');
    const login = await api.call('post', '/api/v1/auth/login', { host, body: { email: 'admin@dfm.local', password: DEFAULT_PASSWORD } });
    expect(login.status).toBe(200);
    const token = login.body.access_token as string;
    const companies = await api.call('get', '/api/v1/companies', { host, token });
    expect(companies.status).toBe(200);
    const company = companies.body[0].id as string;
    const customer = await api.call('post', '/api/v1/customers', {
      host,
      token,
      company,
      body: { type: 'INDIVIDUAL', first_name: 'Down', last_name: 'Time', addresses: [billingAddress] },
    });
    expect(customer.status).toBe(201);
    const roles = await api.call('get', '/api/v1/roles', { host, token });
    const sales = roles.body.find((r: { key: string }) => r.key === 'sales').id as string;
    const invite = await api.call('post', '/api/v1/users/invitations', {
      host,
      token,
      body: { email: `down-${Date.now()}@x.test`, full_name: 'Down', memberships: [{ company_id: company, role_id: sales }] },
    });
    expect(invite.status).toBe(201);
    expect(invite.body.mail_status).toBe('QUEUED');
  });

  it('E-INF-01 a feature that needs a file gets a clear 503, without any address in it', async () => {
    const storage = app.get(StorageService);
    const key = tenantObjectKey('11111111-1111-4111-8111-111111111111', 'exports/down.txt');
    const failure = (await storage.putBuffer(key, Buffer.from('x'), 'text/plain').catch((e: unknown) => e)) as AppException;
    expect(failure).toBeInstanceOf(AppException);
    expect(failure.getStatus()).toBe(503);
    expect(failure.code).toBe('STORAGE_UNAVAILABLE');
    expect(failure.message).not.toMatch(/localhost|http/);
    await expect(storage.exists(key)).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });

  it('E-INF-01 a mail asked for meanwhile stays in the outbox: nothing is lost and the caller is not failed', async () => {
    const { mailJobId, status } = await app
      .get(MailService)
      .enqueue('invitation', null, { to: 'outbox@x.test', subject: 'Later', text: 'later', html: '<p>later</p>' });
    expect(status).toBe('QUEUED');
    const job = await app.get(ControlPrismaService).mailJob.findUniqueOrThrow({ where: { id: mailJobId } });
    expect(job.status).toBe('QUEUED');
    expect(job.publishedAt).toBeNull();
    // Not left for a later run to send
    await app.get(ControlPrismaService).mailJob.delete({ where: { id: mailJobId } });
  });
});
