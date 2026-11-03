import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { connect } from 'amqplib';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/http/configure-app';
import { startWorkers } from '../src/common/workers';
import { ControlPrismaService } from '../src/database/control-prisma.service';
import { ControlDbHealthIndicator } from '../src/modules/health/control-db.health';
import { MailService } from '../src/modules/mail/mail.service';
import { QueueName } from '../src/modules/queue/queue-names';
import { QueueService } from '../src/modules/queue/queue.service';
import { StorageService, tenantObjectKey } from '../src/modules/storage/storage.service';
import { hostOf, uniqueSubdomain } from './support/app';
import { withControl, withAdmin } from './support/db';
import { mailsTo, waitForMails } from './support/mailpit';
import { TenantFixture } from './support/tenant-fixture';

const waitUntil = async (check: () => Promise<boolean> | boolean, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('Condition not reached in time');
    await new Promise((r) => setTimeout(r, 50));
  }
};

/** An app with its own consumer in place of the export worker, registered after init so that it wins. */
async function appWithConsumer(
  handle: (message: unknown) => Promise<void>,
  onDeadLetter?: (message: unknown, error: unknown) => Promise<void>,
) {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  app.get(QueueService).registerConsumer(QueueName.EXPORT, { handle, onDeadLetter });
  await startWorkers(app);
  return app;
}

describe('Infrastructure', () => {
  const fx = new TenantFixture(uniqueSubdomain('infra'));
  // These tests own the export queue through appWithConsumer: the fixture's real export worker must not compete for it
  fx.beforeWorkers = (app) => (app.get(QueueService) as unknown as { consumers: Map<string, unknown> }).consumers.delete(QueueName.EXPORT);
  let call: TenantFixture['call'];
  let queue: QueueService;

  beforeAll(async () => {
    await fx.start();
    call = fx.call.bind(fx);
    queue = fx.app.get(QueueService);
  });
  afterAll(() => fx.stop());

  describe('queue', () => {
    it('BE-INF-04 a job that keeps failing is retried with backoff, then dead-lettered', async () => {
      const attempts: number[] = [];
      let deadLettered = 0;
      const app = await appWithConsumer(
        (message) => {
          if ((message as { run: string }).run === 'always-fails') attempts.push(Date.now());
          return Promise.reject(new Error('still failing'));
        },
        () => {
          deadLettered++;
          return Promise.resolve();
        },
      );
      const q = app.get(QueueService);
      const { dlq } = q.queueNames(QueueName.EXPORT);
      const before = await q.depth(dlq);
      await q.publish(QueueName.EXPORT, { run: 'always-fails' }, 'always-fails-1');
      await waitUntil(() => deadLettered === 1);
      await waitUntil(async () => (await q.depth(dlq)) === before + 1);

      expect(attempts).toHaveLength(4);
      const gaps = attempts.slice(1).map((t, i) => t - attempts[i]);
      expect(gaps[0]).toBeGreaterThanOrEqual(90);
      expect(gaps[1]).toBeGreaterThanOrEqual(190);
      expect(gaps[2]).toBeGreaterThanOrEqual(290);
      await app.close();
    });

    it('E-INF-05 stopping while a job runs: the job finishes first; an unfinished one goes to the next process', async () => {
      let release!: () => void;
      const started = new Promise<void>((r) => (release = r));
      let finished = 0;
      const first = await appWithConsumer(async () => {
        release();
        await new Promise((r) => setTimeout(r, 400));
        finished++;
      });
      await first.get(QueueService).publish(QueueName.EXPORT, { run: 'graceful' }, 'graceful-1');
      await started;
      await first.close();
      expect(finished).toBe(1);

      let delivered = 0;
      const stuck = await appWithConsumer(() => {
        delivered++;
        return new Promise(() => undefined);
      });
      await stuck.get(QueueService).publish(QueueName.EXPORT, { run: 'stuck' }, 'stuck-1');
      await waitUntil(() => delivered === 1);
      await stuck.close();

      const received: unknown[] = [];
      const next = await appWithConsumer((message) => {
        received.push(message);
        return Promise.resolve();
      });
      await waitUntil(() => received.some((m) => (m as { run: string }).run === 'stuck'));
      await next.close();
    }, 120_000);

    it('BE-INF-05 a message delivered twice sends one mail', async () => {
      const to = fx.email('dup');
      const { mailJobId } = await fx.app
        .get(MailService)
        .enqueue('invitation', null, { to, subject: 'Once', text: 'once', html: '<p>once</p>' });
      await waitForMails(to);
      await queue.publish(QueueName.MAIL, { mailJobId }, `${mailJobId}-again`);
      await new Promise((r) => setTimeout(r, 800));
      expect(await mailsTo(to)).toHaveLength(1);
      const job = await fx.app.get(ControlPrismaService).mailJob.findUniqueOrThrow({ where: { id: mailJobId } });
      expect(job.status).toBe('SENT');
      expect(job.payloadEnc).toBeNull();
    });

    it('E-INF-02 malformed and unknown messages reach the dead-letter queue; the consumer keeps working', async () => {
      const { main, dlq } = queue.queueNames(QueueName.MAIL);
      const before = await queue.depth(dlq);
      const connection = await connect(process.env.RABBITMQ_URL!);
      const channel = await connection.createConfirmChannel();
      channel.sendToQueue(main, Buffer.from('this is not json'), { persistent: true });
      await channel.waitForConfirms();
      await connection.close();
      await queue.publish(QueueName.MAIL, { nonsense: true }, 'malformed-1');
      await queue.publish(QueueName.MAIL, { mailJobId: '00000000-0000-4000-8000-000000000000' }, 'unknown-1');
      await waitUntil(async () => (await queue.depth(dlq)) === before + 3);

      const to = fx.email('alive');
      await fx.app.get(MailService).enqueue('invitation', null, { to, subject: 'Alive', text: 'alive', html: '<p>alive</p>' });
      await waitForMails(to);
    });

    it('E-INF-04 a line break or HTML in a name changes neither the headers nor the markup of a mail', async () => {
      const evil = new TenantFixture(uniqueSubdomain('evil'));
      evil.app = fx.app;
      evil.api = fx.api;
      await fx.api.createTenant(fx.platform, evil.sub, { plan: 'business' });
      const admin = await fx.api.adminLogin(evil.sub);
      for (const r of (await evil.call('get', '/api/v1/roles', { token: admin })).body) evil.roles[r.key] = r.id;
      const injected = 'Evil\r\nBcc: stolen@evil.example\r\n\r\n<script>alert(1)</script>';
      await evil.sql('UPDATE companies SET legal_name = $1', [injected]);
      const companyId = (await evil.call('get', '/api/v1/companies', { token: admin })).body[0].id;
      const to = evil.email('target');
      const res = await evil.call('post', '/api/v1/users/invitations', {
        token: admin,
        body: { email: to, full_name: 'x', memberships: [{ company_id: companyId, role_id: evil.roles.sales }] },
      });
      expect(res.status).toBe(201);
      const [mail] = await waitForMails(to);
      expect(mail.Subject).not.toMatch(/[\r\n]/);
      expect((mail as unknown as { Bcc: unknown[] }).Bcc ?? []).toHaveLength(0);
      expect(await mailsTo('stolen@evil.example')).toHaveLength(0);
      expect(mail.HTML).not.toContain('<script>');
      expect(mail.HTML).toContain('&lt;script&gt;');
    });
  });

  describe('storage', () => {
    it('BE-INF-06 files live under the tenant, the bucket exists by itself, a link expires', async () => {
      const storage = fx.app.get(StorageService);
      const tenantId = '11111111-1111-4111-8111-111111111111';
      const key = tenantObjectKey(tenantId, 'exports/e2e.txt');
      expect(key.startsWith(`tenants/${tenantId}/`)).toBe(true);
      expect(() => tenantObjectKey(tenantId, '../other/secret')).toThrow();
      expect(() => tenantObjectKey('../x', 'a')).toThrow();

      await storage.putBuffer(key, Buffer.from('content'), 'text/plain');
      const link = await storage.presignedDownloadUrl(key, 1, 'e2e.txt');
      expect((await fetch(link)).status).toBe(200);
      await new Promise((r) => setTimeout(r, 2200));
      expect((await fetch(link)).status).toBe(403);
      await storage.delete(key);
      expect(await storage.exists(key)).toBe(false);
    });
  });

  describe('HTTP edge', () => {
    it('BE-INF-09 a forged Host or X-Forwarded-Host never changes the tenant', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const forged = await call('get', '/api/v1/auth/me', {
        token: access,
        headers: { 'X-Forwarded-Host': hostOf('dfm'), Forwarded: `host=${hostOf('dfm')}` },
      });
      expect(forged.status).toBe(200);
      expect(forged.body.email).toBe(u.email);

      expect((await fx.api.call('get', '/api/v1/auth/me', { host: hostOf('no-such-tenant') })).status).toBe(404);
      const noHostTenant = await fx.api.call('post', '/api/v1/auth/login', {
        headers: { 'X-Forwarded-Host': fx.host },
        body: { email: u.email, password: u.password },
      });
      expect(noHostTenant.status).not.toBe(200);
      const adminHost = await fx.api.call('get', '/api/v1/companies', { host: 'admin.localhost', token: access });
      expect(adminHost.status).toBe(200);
      expect(adminHost.body[0].id).toBe(fx.companyA);
    });

    it('BE-INF-10 /metrics exists only for who holds the token, and has the numbers', async () => {
      await call('get', '/health/live');
      const token = process.env.METRICS_TOKEN!;
      expect((await fx.api.call('get', '/metrics')).status).toBe(404);
      expect((await fx.api.call('get', '/metrics', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(404);
      const ok = await fx.api.call('get', '/metrics', { headers: { Authorization: `Bearer ${token}` } });
      expect(ok.status).toBe(200);
      expect(ok.text).toContain('http_request_duration_seconds');
      expect(ok.text).toContain('broker_connected 1');
      expect(ok.text).toContain('storage_reachable 1');
      expect(ok.text).toContain('process_cpu_seconds_total');
      expect(ok.text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    });

    it('BE-INF-03 readiness: everything up, each part named', async () => {
      const ready = await fx.api.call('get', '/health/ready');
      expect(ready.status).toBe(200);
      expect(ready.body).toEqual({ status: 'ok', components: { control_db: 'up', broker: 'up', storage: 'up' } });
    });

    it('BE-INF-03 readiness is 503 without the control DB, naming nothing else; live stays 200', async () => {
      const indicator = fx.app.get(ControlDbHealthIndicator, { strict: false });
      const down = jest.spyOn(indicator, 'check').mockResolvedValue({ controlDb: { status: 'down', message: 'unreachable' } } as never);
      try {
        const ready = await fx.api.call('get', '/health/ready');
        expect(ready.status).toBe(503);
        expect(ready.body.code).toBe('NOT_READY');
        expect(ready.body.message).toBe('Not ready: control_db');
        expect((await fx.api.call('get', '/health/live')).status).toBe(200);
      } finally {
        down.mockRestore();
      }
    });

    it('E-INF-06 no database connection left: a clear 503 that names nothing, and it recovers by itself', async () => {
      const { rows } = await withControl((c) => c.query('SELECT db_app_user, db_name FROM tenants WHERE subdomain = $1', [fx.sub]));
      const { db_app_user: role } = rows[0];
      await withAdmin(async (a) => {
        await a.query(`ALTER ROLE "${role}" CONNECTION LIMIT 0`);
        await a.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = $1`, [role]);
      });
      try {
        await new Promise((r) => setTimeout(r, 200));
        const res = await fx.login('nobody@x.test');
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('DB_UNAVAILABLE');
        expect(JSON.stringify(res.body)).not.toMatch(/postgres|tenant_|password|localhost/i);
      } finally {
        await withAdmin((a) => a.query(`ALTER ROLE "${role}" CONNECTION LIMIT -1`));
      }
      await waitUntil(async () => (await fx.login('nobody@x.test')).status === 401);
    });
  });

  describe('input', () => {
    it('E-API-01 SQL in keyword or an unknown sort: no SQL runs, 422 for the sort', async () => {
      const list = await call('get', `/api/v1/customers?search=${encodeURIComponent(`'; DROP TABLE customers; --`)}`, {
        token: fx.admin,
        company: fx.companyA,
      });
      expect(list.status).toBe(200);
      expect(list.body.items).toEqual([]);
      expect((await fx.sql('SELECT count(*) FROM customers')).length).toBe(1);
      expect((await call('get', '/api/v1/customers?sort=password_hash', { token: fx.admin, company: fx.companyA })).status).toBe(422);
    });

    it('E-API-02 page 0, negative or text, and a huge page_size: 422', async () => {
      for (const q of ['page=0', 'page=-1', 'page=abc', 'page_size=100000', 'page_size=0']) {
        expect((await call('get', `/api/v1/customers?${q}`, { token: fx.admin, company: fx.companyA })).status).toBe(422);
      }
    });

    it('E-API-03 extra fields, or a hidden status, role_id or tenant_id: 422 and nothing is assigned', async () => {
      const u = await fx.user();
      for (const body of [
        { full_name: 'x', status: 'ACTIVE' },
        { full_name: 'x', role_id: fx.roles.tenant_admin },
        { full_name: 'x', tenant_id: 'y' },
      ]) {
        expect((await call('patch', `/api/v1/users/${u.id}`, { token: fx.admin, body })).status).toBe(422);
      }
    });

    it('E-API-04 body too large 413, broken JSON 400, wrong content type 422, NUL byte 422; never 500', async () => {
      const big = await fx.login('a@b.test', 'x'.repeat(1024 * 1024));
      expect(big.status).toBe(413);
      expect(big.body.code).toBe('PAYLOAD_TOO_LARGE');
      const broken = await call('post', '/api/v1/auth/login', { headers: { 'Content-Type': 'application/json' } }).send('{"email":');
      expect(broken.status).toBe(400);
      const wrongType = await call('post', '/api/v1/auth/login', { headers: { 'Content-Type': 'text/plain' } }).send('email=a');
      expect(wrongType.status).toBe(422);
      const nul = await fx.login('a\u0000@b.test', 'Some-Password-123');
      expect(nul.status).toBe(422);
    });

    it('E-API-05 malformed id 400; an id of another tenant or company: 404, nothing to learn', async () => {
      expect((await call('get', '/api/v1/customers/not-a-uuid', { token: fx.admin, company: fx.companyA })).status).toBe(400);
      expect((await call('get', '/api/v1/users/not-a-uuid/status', { token: fx.admin })).status).toBe(404);
      const created = await call('post', '/api/v1/customers', {
        token: fx.admin,
        company: fx.companyB,
        body: { type: 'COMPANY', name: 'In B', addresses: [{ type: 'BILLING', line1: '1 st', postal_code: '10001', city: 'NYC' }] },
      });
      expect(created.status).toBe(201);
      expect((await call('get', `/api/v1/customers/${created.body.id}`, { token: fx.admin, company: fx.companyA })).status).toBe(404);
      expect(
        (await call('get', '/api/v1/customers/00000000-0000-4000-8000-000000000000', { token: fx.admin, company: fx.companyA })).status,
      ).toBe(404);
    });
  });
});
