import { NestExpressApplication } from '@nestjs/platform-express';
import { Secret, TOTP } from 'otpauth';
import { Api, createTestApp, hostOf, uniqueSubdomain, USER_PASSWORD } from './app';
import { withControl, withTenantDb } from './db';

type Method = Parameters<Api['call']>[0];
type Options = Parameters<Api['call']>[2];

/** A fresh tenant with its first admin, and the calls every auth/users spec needs. */
export const LARGE_PLAN = 'e2e_large';

/** These specs create far more users than any sold plan allows; the limits have their own tests. */
export const ensureLargePlan = () =>
  withControl((c) =>
    c.query(
      `INSERT INTO plans (id, code, name, max_users, max_companies, max_invoices_monthly, max_ai_calls_monthly, updated_at)
       VALUES (gen_random_uuid(), $1, 'E2E large', 100000, 1000, 100000, 100000, now()) ON CONFLICT (code) DO NOTHING`,
      [LARGE_PLAN],
    ),
  );

export class TenantFixture {
  app!: NestExpressApplication;
  api!: Api;
  admin!: string;
  companyA!: string;
  companyB!: string;
  platform!: string;
  readonly roles: Record<string, string> = {};
  readonly host: string;
  /** Runs between init and the start of the workers. */
  beforeWorkers?: (app: NestExpressApplication) => void;
  private seq = 0;

  constructor(readonly sub: string = uniqueSubdomain('fx')) {
    this.host = hostOf(sub);
  }

  async start() {
    this.app = await createTestApp(this.beforeWorkers);
    this.api = new Api(this.app);
    this.platform = await this.api.platformToken();
    await ensureLargePlan();
    await this.api.createTenant(this.platform, this.sub, { plan: LARGE_PLAN });
    this.admin = await this.api.adminLogin(this.sub);
    this.companyA = (await this.call('get', '/api/v1/companies', { token: this.admin })).body[0].id;
    this.companyB = (
      await this.call('post', '/api/v1/companies', {
        token: this.admin,
        body: { legal_name: 'Second Inc', country_code: 'US', currency: 'USD' },
      })
    ).body.id;
    for (const r of (await this.call('get', '/api/v1/roles', { token: this.admin })).body) this.roles[r.key] = r.id;
    return this;
  }

  stop() {
    return this.app.close();
  }

  call(method: Method, path: string, opts: Options = {}) {
    return this.api.call(method, path, { host: this.host, ...opts });
  }

  email(label = 'user') {
    return `${label}-${++this.seq}-${Date.now().toString(36)}@${this.sub}.test`;
  }

  /** A user through the deprecated direct route: fastest way to an ACTIVE account with a known password. */
  async user(roleKey = 'sales', companyId: string | null = this.companyA, label = 'user') {
    const email = this.email(label);
    const res = await this.call('post', '/api/v1/users', {
      token: this.admin,
      body: {
        email,
        full_name: `Name ${email}`,
        password: USER_PASSWORD,
        memberships: [{ company_id: companyId, role_id: this.roles[roleKey] }],
      },
    });
    if (res.status !== 201) throw new Error(`user ${res.status} ${JSON.stringify(res.body)}`);
    return { id: res.body.id as string, email, password: USER_PASSWORD };
  }

  login(email: string, password = USER_PASSWORD, opts: Options = {}) {
    return this.call('post', '/api/v1/auth/login', { body: { email, password }, ...opts });
  }

  /** Access and refresh token of a user without 2FA. */
  async session(email: string, password = USER_PASSWORD) {
    const res = await this.login(email, password);
    if (res.status !== 200 || !res.body.access_token) throw new Error(`session ${res.status} ${JSON.stringify(res.body)}`);
    return { access: res.body.access_token as string, refresh: res.body.refresh_token as string, body: res.body };
  }

  refresh(token: string, opts: Options = {}) {
    return this.call('post', '/api/v1/auth/refresh', { body: { refresh_token: token }, ...opts });
  }

  /** Owner connection: what no API request can do, like moving time or reading raw rows. */
  sql<R extends object = Record<string, unknown>>(text: string, values: unknown[] = []) {
    return withTenantDb(this.sub, async (c) => (await c.query<R & import('pg').QueryResultRow>(text, values)).rows);
  }

  async auditActions(entityId?: string) {
    const rows = await this.sql<{ action: string }>(
      `SELECT action FROM audit_logs ${entityId ? 'WHERE entity_id = $1' : ''}`,
      entityId ? [entityId] : [],
    );
    return rows.map((r) => r.action);
  }

  async enableMfa(access: string) {
    const setup = await this.call('post', '/api/v1/me/mfa/setup', { token: access });
    if (setup.status !== 200) throw new Error(`mfa setup ${setup.status} ${JSON.stringify(setup.body)}`);
    const secret = setup.body.secret as string;
    const confirm = await this.call('post', '/api/v1/me/mfa/confirm', { token: access, body: { code: totp(secret) } });
    if (confirm.status !== 200) throw new Error(`mfa confirm ${confirm.status} ${JSON.stringify(confirm.body)}`);
    return { secret, setup: setup.body, recoveryCodes: confirm.body.recovery_codes as string[] };
  }
}

export function totp(secret: string, stepOffset = 0): string {
  return new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate({
    timestamp: Date.now() + stepOffset * 30_000,
  });
}

export const decodeJwt = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as Record<string, unknown>;
