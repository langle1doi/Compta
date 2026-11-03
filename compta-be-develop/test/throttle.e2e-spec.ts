import './support/low-login-limit';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DEFAULT_PASSWORD, SUPER_ADMIN_EMAIL } from '../src/modules/platform/tenants/default-accounts';
import { Api, createTestApp, hostOf, uniqueSubdomain } from './support/app';

describe('Rate limiting', () => {
  let app: NestExpressApplication;
  let api: Api;

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
  });
  afterAll(() => app.close());

  it('limits login attempts per IP with 429 RATE_LIMITED; other routes are unaffected', async () => {
    const body = { email: 'nobody@platform.test', password: 'Wrong-Password-1' };
    for (let i = 0; i < 3; i++) expect((await api.call('post', '/platform/api/v1/auth/login', { body })).status).toBe(401);
    const limited = await api.call('post', '/platform/api/v1/auth/login', { body });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('RATE_LIMITED');
    expect((await api.call('get', '/health/live')).status).toBe(200);
  });

  describe('per IP and per email', () => {
    const SECRET = process.env.INTERNAL_PROXY_SECRET!;
    const a = uniqueSubdomain('thr-a');
    const b = uniqueSubdomain('thr-b');
    const login = (sub: string, email: string, ip: string, secret = SECRET) =>
      api.call('post', '/api/v1/auth/login', {
        host: hostOf(sub),
        headers: { 'X-Client-Ip': ip, 'X-Internal-Proxy-Secret': secret },
        body: { email, password: 'Wrong-Password-1' },
      });

    beforeAll(async () => {
      const login = await api.call('post', '/platform/api/v1/auth/login', {
        headers: { 'X-Client-Ip': '10.0.9.9', 'X-Internal-Proxy-Secret': SECRET },
        body: { email: SUPER_ADMIN_EMAIL, password: DEFAULT_PASSWORD },
      });
      const platform = login.body.access_token as string;
      await api.createTenant(platform, a);
      await api.createTenant(platform, b);
    }, 120_000);

    it('BE-F02-05 same email from many IPs is stopped by the email limit; same IP with many emails by the IP limit; another tenant is untouched', async () => {
      const email = 'target@throttle.test';
      for (let i = 1; i <= 4; i++) expect((await login(a, email, `10.0.0.${i}`)).status).toBe(401);
      const byEmail = await login(a, email, '10.0.0.5');
      expect(byEmail.status).toBe(429);

      for (let i = 1; i <= 3; i++) expect((await login(a, `u${i}@throttle.test`, '10.0.1.1')).status).toBe(401);
      expect((await login(a, 'u4@throttle.test', '10.0.1.1')).status).toBe(429);

      expect((await login(b, email, '10.0.1.1')).status).toBe(401);
    });

    it('BE-INF-08 X-Client-Ip counts only with the right secret, and two tenants do not share a limit', async () => {
      // A spoofed address with a wrong secret falls back to the real socket: every attempt lands on one counter
      const results = [];
      for (let i = 1; i <= 4; i++) results.push((await login(b, `spoof${i}@throttle.test`, `10.9.9.${i}`, 'wrong-secret')).status);
      expect(results).toContain(429);
      // With the right secret each address has its own counter
      for (let i = 1; i <= 4; i++) expect((await login(a, `real${i}@throttle.test`, `10.8.8.${i}`)).status).toBe(401);
    });

    it('E-PWD-01 forgot password is limited per email too', async () => {
      const forgot = (ip: string) =>
        api.call('post', '/api/v1/auth/password/forgot', {
          host: hostOf(a),
          headers: { 'X-Client-Ip': ip, 'X-Internal-Proxy-Secret': SECRET },
          body: { email: 'forgot@throttle.test' },
        });
      for (let i = 1; i <= 4; i++) expect((await forgot(`10.7.7.${i}`)).status).toBe(202);
      expect((await forgot('10.7.7.5')).status).toBe(429);
    });

    it('BE-F02-33 E-MFA-04 more than 5 2FA attempts a minute: 429', async () => {
      const statuses = [];
      for (let i = 0; i < 6; i++) {
        statuses.push(
          (
            await api.call('post', '/api/v1/auth/mfa/verify', {
              host: hostOf(a),
              headers: { 'X-Client-Ip': '10.6.6.6', 'X-Internal-Proxy-Secret': SECRET },
              body: { mfa_token: 'x', code: '000000' },
            })
          ).status,
        );
      }
      expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
      expect(statuses[5]).toBe(429);
    });
  });
});
