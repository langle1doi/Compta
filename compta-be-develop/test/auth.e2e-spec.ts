import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { resetUserMfa } from '../src/cli/reset-user-mfa';
import { ControlEventsService } from '../src/database/control-events.service';
import { DEFAULT_PASSWORD } from '../src/modules/platform/tenants/default-accounts';
import { ADMIN_PASSWORD, uniqueSubdomain, USER_PASSWORD } from './support/app';
import { withControl } from './support/db';
import { mailsTo, tokenIn, waitForMails } from './support/mailpit';
import { decodeJwt, TenantFixture, totp } from './support/tenant-fixture';

const WRONG = 'Definitely-Wrong-Password-1';
const NEW_PASSWORD = 'Brand-New-Password-2026';

describe('F02 login (tenant)', () => {
  const fx = new TenantFixture(uniqueSubdomain('auth'));
  const other = new TenantFixture(uniqueSubdomain('auth2'));
  let call: TenantFixture['call'];

  const age = (table: string, column: string, id: string, idColumn: string, interval: string) =>
    fx.sql(`UPDATE ${table} SET ${column} = (now() AT TIME ZONE 'UTC') - interval '${interval}' WHERE ${idColumn} = $1`, [id]);
  const hash = (token: string) => createHash('sha256').update(token).digest('hex');
  const sessionsOf = (userId: string) => fx.sql<{ id: string }>('SELECT id FROM sessions WHERE user_id = $1', [userId]);
  /** Rows changed directly in SQL: what a NOTIFY would have told the cache */
  const forgetSession = (tenantId: string, sessionId: string) =>
    fx.app.get(ControlEventsService).publish({ kind: 'session', tenantId, sessionId });
  let tenantId: string;

  beforeAll(async () => {
    await fx.start();
    other.app = fx.app;
    other.api = fx.api;
    await fx.api.createTenant(fx.platform, other.sub, { plan: 'business' });
    other.admin = await fx.api.adminLogin(other.sub);
    call = fx.call.bind(fx);
    tenantId = (await withControl((c) => c.query('SELECT id FROM tenants WHERE subdomain = $1', [fx.sub]))).rows[0].id;
  });
  afterAll(() => fx.stop());

  describe('login', () => {
    it('BE-F02-01 default sales@dfm logs in: access + refresh token, no mfa_required', async () => {
      const res = await fx.api.call('post', '/api/v1/auth/login', {
        host: 'dfm.localhost',
        body: { email: 'sales@dfm.local', password: DEFAULT_PASSWORD },
      });
      expect(res.status).toBe(200);
      expect(res.body.access_token).toEqual(expect.any(String));
      expect(res.body.refresh_token).toEqual(expect.any(String));
      expect(res.body.mfa_required).toBe(false);
    });

    it('BE-F02-02 wrong password, unknown email, disabled and invited users get the same 401', async () => {
      const disabled = await fx.user();
      await call('patch', `/api/v1/users/${disabled.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } });
      const invited = fx.email('invited');
      await call('post', '/api/v1/users/invitations', {
        token: fx.admin,
        body: { email: invited, full_name: 'Invited', memberships: [{ company_id: fx.companyA, role_id: fx.roles.sales }] },
      });
      const known = await fx.user();

      const answers = [];
      for (const [email, password] of [
        [known.email, WRONG],
        [fx.email('unknown'), USER_PASSWORD],
        [disabled.email, USER_PASSWORD],
        [invited, USER_PASSWORD],
      ]) {
        const started = Date.now();
        const res = await fx.login(email, password);
        answers.push({ status: res.status, code: res.body.code, message: res.body.message, ms: Date.now() - started });
      }
      const first = answers[0];
      for (const a of answers)
        expect({ status: a.status, code: a.code, message: a.message }).toEqual({ status: 401, code: first.code, message: first.message });
      // Every path spends one password hash: an unknown address is not much faster than a known one
      expect(answers[1].ms).toBeGreaterThan(answers[0].ms / 4);
    });

    it('BE-F02-03 5 failures lock the account: generic 401 with the right password, warning mail once, open again after 15 minutes', async () => {
      const u = await fx.user();
      for (let i = 0; i < 5; i++) expect((await fx.login(u.email, WRONG)).status).toBe(401);
      const locked = await fx.login(u.email);
      expect(locked.status).toBe(401);
      expect(locked.body.code).toBe('INVALID_CREDENTIALS');

      const [mail] = await waitForMails(u.email);
      expect(mail.Text).toMatch(/15/);
      await fx.login(u.email, WRONG);
      expect(await mailsTo(u.email)).toHaveLength(1);

      await fx.sql(`UPDATE users SET locked_until = (now() AT TIME ZONE 'UTC') - interval '1 second' WHERE id = $1`, [u.id]);
      expect((await fx.login(u.email)).status).toBe(200);
    });

    it('BE-F02-04 the counter restarts after a successful login', async () => {
      const u = await fx.user();
      for (const _ of [1, 2]) {
        for (let i = 0; i < 4; i++) expect((await fx.login(u.email, WRONG)).status).toBe(401);
        expect((await fx.login(u.email)).status).toBe(200);
      }
    });

    it('BE-F02-06 password rules on /me/password: 11 chars and common refused, 12 accepted, stored as Argon2id', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const change = (new_password: string) =>
        call('post', '/api/v1/me/password', { token: access, body: { current_password: USER_PASSWORD, new_password } });
      expect((await change('Abcdefgh123')).status).toBe(422);
      expect((await change('password1234')).status).toBe(422);
      expect((await change('Valid-Pass12')).status).toBe(204);
      const [row] = await fx.sql<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [u.id]);
      expect(row.password_hash).toMatch(/^\$argon2id\$/);
    });

    it('BE-F02-07 BE-F02-09 access token: 15 minutes, no secret. PRD deviation: company ids and roles are not in the token', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const claims = decodeJwt(access);
      expect((claims.exp as number) - (claims.iat as number)).toBe(900);
      expect(Object.keys(claims).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sid', 'sub', 'tid', 'typ', 'ver']);
      expect(claims.sub).toBe(u.id);
      expect(claims.tid).toBe(tenantId);
    });

    it('BE-F02-08 a token of one tenant on the host of another: 401 WRONG_TENANT', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const res = await other.call('get', '/api/v1/auth/me', { token: access });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('WRONG_TENANT');
    });
  });

  describe('refresh, logout, sessions', () => {
    it('BE-F02-10 a valid refresh gives a new pair; the old refresh token is spent', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      const res = await fx.refresh(s.refresh);
      expect(res.status).toBe(200);
      expect(res.body.refresh_token).not.toBe(s.refresh);
      expect((await call('get', '/api/v1/auth/me', { token: res.body.access_token })).status).toBe(200);
      await fx.sql(`UPDATE refresh_tokens SET used_at = used_at - interval '1 minute' WHERE token_hash = $1`, [hash(s.refresh)]);
      expect((await fx.refresh(s.refresh)).status).toBe(401);
    });

    it('BE-F02-11 reuse of a spent token (past the grace) kills the chain, the new token too, with audit', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      const fresh = await fx.refresh(s.refresh);
      await fx.sql(`UPDATE refresh_tokens SET used_at = used_at - interval '1 minute' WHERE token_hash = $1`, [hash(s.refresh)]);

      const reuse = await fx.refresh(s.refresh);
      expect(reuse.status).toBe(401);
      expect(reuse.body.code).toBe('TOKEN_REVOKED');
      expect((await fx.refresh(fresh.body.refresh_token)).status).toBe(401);
      expect((await call('get', '/api/v1/auth/me', { token: fresh.body.access_token })).status).toBe(401);
      const rows = await fx.sql<{ user_id: string }>(
        `SELECT user_id FROM audit_logs WHERE action = 'auth.refresh_reuse' AND user_id = $1`,
        [u.id],
      );
      expect(rows).toHaveLength(1);
    });

    it('BE-F02-12 expired after 7 days, garbage, and a token of another tenant: 401', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      await fx.sql(`UPDATE refresh_tokens SET expires_at = (now() AT TIME ZONE 'UTC') - interval '1 second' WHERE token_hash = $1`, [
        hash(s.refresh),
      ]);
      expect((await fx.refresh(s.refresh)).status).toBe(401);
      expect((await fx.refresh('not-a-token')).status).toBe(401);
      expect((await fx.refresh(`${tenantId}.forged`)).status).toBe(401);

      const v = await fx.user();
      const t = await fx.session(v.email);
      expect((await other.call('post', '/api/v1/auth/refresh', { body: { refresh_token: t.refresh } })).status).toBe(401);
    });

    it('BE-F02-13 only the hash of a refresh token is stored', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      const [session] = await sessionsOf(u.id);
      const rows = await fx.sql<{ token_hash: string }>('SELECT token_hash FROM refresh_tokens WHERE session_id = $1', [session.id]);
      expect(rows.map((r) => r.token_hash)).toEqual([hash(s.refresh)]);
      expect(JSON.stringify(rows)).not.toContain(s.refresh);
    });

    it('BE-F02-14 after logout, refresh and access are both 401 at the next request', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      expect((await call('post', '/api/v1/auth/logout', { token: s.access, body: { refresh_token: s.refresh } })).status).toBe(204);
      expect((await fx.refresh(s.refresh)).status).toBe(401);
      expect((await call('get', '/api/v1/auth/me', { token: s.access })).status).toBe(401);
    });

    it('BE-F02-15 30 minutes without activity: refresh 401, and the access token dies with the session', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      const [session] = await sessionsOf(u.id);
      await age('sessions', 'last_used_at', session.id, 'id', '30 minutes');
      await forgetSession(tenantId, session.id);
      await new Promise((r) => setTimeout(r, 200));
      expect((await call('get', '/api/v1/auth/me', { token: s.access })).status).toBe(401);
      expect((await fx.refresh(s.refresh)).status).toBe(401);
    });

    it('BE-F02-16 E-SESS-04 past 12 hours the session ends, however active: refreshing never extends it', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      const first = await fx.refresh(s.refresh);
      const [session] = await sessionsOf(u.id);
      const [{ expires_at }] = await fx.sql<{ expires_at: Date }>('SELECT expires_at FROM sessions WHERE id = $1', [session.id]);
      const again = await fx.refresh(first.body.refresh_token);
      const [{ expires_at: after }] = await fx.sql<{ expires_at: Date }>('SELECT expires_at FROM sessions WHERE id = $1', [session.id]);
      expect(after).toEqual(expires_at);

      await fx.sql(`UPDATE sessions SET expires_at = (now() AT TIME ZONE 'UTC') - interval '1 second' WHERE id = $1`, [session.id]);
      expect((await fx.refresh(again.body.refresh_token)).status).toBe(401);
    });

    it('BE-F02-17 /me/sessions shows only your own; a deleted one stops working; another user cannot delete yours', async () => {
      const a = await fx.user();
      const b = await fx.user();
      const a1 = await fx.session(a.email);
      const a2 = await fx.session(a.email);
      const b1 = await fx.session(b.email);

      const list = await call('get', '/api/v1/me/sessions', { token: a1.access });
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(2);
      expect(list.body.filter((x: { current: boolean }) => x.current)).toHaveLength(1);
      expect(JSON.stringify(list.body)).not.toMatch(/token/);

      const target = list.body.find((x: { current: boolean }) => !x.current).id;
      expect((await call('delete', `/api/v1/me/sessions/${target}`, { token: b1.access })).status).toBe(404);
      expect((await call('get', '/api/v1/auth/me', { token: a2.access })).status).toBe(200);
      expect((await call('delete', `/api/v1/me/sessions/${target}`, { token: a1.access })).status).toBe(204);
      expect((await call('get', '/api/v1/auth/me', { token: a2.access })).status).toBe(401);
      expect((await fx.refresh(a2.refresh)).status).toBe(401);
    });

    it('BE-F02-18 locking a logged-in user: the next request is 401, every refresh is dead', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      await call('patch', `/api/v1/users/${u.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } });
      expect((await call('get', '/api/v1/auth/me', { token: s.access })).status).toBe(401);
      expect((await fx.refresh(s.refresh)).status).toBe(401);
    });

    it('E-SESS-01 two tabs refreshing the same token at once both succeed; a late reuse is still caught', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      const [a, b] = await Promise.all([fx.refresh(s.refresh), fx.refresh(s.refresh)]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect((await fx.refresh(a.body.refresh_token)).status).toBe(200);
      expect((await fx.refresh(b.body.refresh_token)).status).toBe(200);
      await fx.sql(`UPDATE refresh_tokens SET used_at = used_at - interval '1 minute' WHERE token_hash = $1`, [hash(s.refresh)]);
      expect((await fx.refresh(s.refresh)).status).toBe(401);
    });

    it('E-SESS-01 within the grace, another client is not the same tab: treated as theft', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      expect((await fx.refresh(s.refresh)).status).toBe(200);
      expect((await fx.refresh(s.refresh, { headers: { 'User-Agent': 'something-else' } })).status).toBe(401);
    });

    it('E-SESS-02 a user disabled while a refresh runs gets no token that works', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      const [refreshed] = await Promise.all([
        fx.refresh(s.refresh),
        call('patch', `/api/v1/users/${u.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } }),
      ]);
      if (refreshed.status === 200) {
        expect((await call('get', '/api/v1/auth/me', { token: refreshed.body.access_token })).status).toBe(401);
        expect((await fx.refresh(refreshed.body.refresh_token)).status).toBe(401);
      } else {
        expect(refreshed.status).toBe(401);
      }
    });

    it('E-SESS-03 refresh on a suspended tenant: 403 TENANT_SUSPENDED, no token', async () => {
      const third = new TenantFixture(uniqueSubdomain('susp'));
      third.app = fx.app;
      third.api = fx.api;
      const created = await fx.api.createTenant(fx.platform, third.sub);
      const login = await third.login(`admin@${third.sub}.test`, ADMIN_PASSWORD);
      await fx.api.call('patch', `/platform/api/v1/tenants/${created.id}/status`, {
        token: fx.platform,
        body: { status: 'SUSPENDED', confirm_name: `Tenant ${third.sub}` },
      });
      const res = await third.refresh(login.body.refresh_token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TENANT_SUSPENDED');
      expect(res.body.access_token).toBeUndefined();
      const without = await fx.api.call('post', '/api/v1/auth/refresh', { body: { refresh_token: login.body.refresh_token } });
      expect(without.status).toBe(403);
    });

    it('E-SESS-06 logging out twice, or with an expired or unknown token, still succeeds', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      const logout = () => call('post', '/api/v1/auth/logout', { token: s.access, body: { refresh_token: s.refresh } });
      expect((await logout()).status).toBe(204);
      expect((await logout()).status).toBe(204);
      expect((await call('post', '/api/v1/auth/logout', { token: 'expired.token.here', body: {} })).status).toBe(204);
      expect((await call('post', '/api/v1/auth/logout', { body: { refresh_token: 'unknown' } })).status).toBe(204);
    });

    it('E-SESS-07 revoking the session in use logs out at once', async () => {
      const u = await fx.user();
      const s = await fx.session(u.email);
      const list = await call('get', '/api/v1/me/sessions', { token: s.access });
      expect((await call('delete', `/api/v1/me/sessions/${list.body[0].id}`, { token: s.access })).status).toBe(204);
      expect((await call('get', '/api/v1/auth/me', { token: s.access })).status).toBe(401);
    });

    it('E-SESS-08 BE-F02-49 changing a role applies at the next request; permissions_version goes up', async () => {
      const u = await fx.user('sales');
      const s = await fx.session(u.email);
      const before = await call('get', '/api/v1/auth/me/permissions', { token: s.access, company: fx.companyA });
      expect((await call('get', '/api/v1/audit-logs', { token: s.access, company: fx.companyA })).status).toBe(403);

      const res = await call('put', `/api/v1/users/${u.id}/memberships`, {
        token: fx.admin,
        body: { memberships: [{ company_id: fx.companyA, role_id: fx.roles.owner }] },
      });
      expect(res.status).toBe(200);
      const after = await call('get', '/api/v1/auth/me/permissions', { token: s.access, company: fx.companyA });
      expect(after.body.permissions_version).toBeGreaterThan(before.body.permissions_version);
      expect((await call('get', '/api/v1/audit-logs', { token: s.access, company: fx.companyA })).status).toBe(200);
    });
  });

  describe('tokens (edge cases)', () => {
    it('E-AUTH-01 email is normalized the same way at login, invitation and forgot password', async () => {
      const u = await fx.user();
      expect((await fx.login(`  ${u.email.toUpperCase()}  `)).status).toBe(200);
      const email = fx.email('norm');
      const invite = await call('post', '/api/v1/users/invitations', {
        token: fx.admin,
        body: {
          email: `  ${email.toUpperCase()} `,
          full_name: 'Norm',
          memberships: [{ company_id: fx.companyA, role_id: fx.roles.sales }],
        },
      });
      expect(invite.status).toBe(201);
      expect(invite.body.user.email).toBe(email);
      await call('post', '/api/v1/auth/password/forgot', { body: { email: `  ${u.email.toUpperCase()} ` } });
      await waitForMails(u.email);
    });

    it('E-AUTH-02 huge, unicode and NUL passwords: answered fast, never 500', async () => {
      const u = await fx.user();
      const started = Date.now();
      const huge = await fx.login(u.email, 'x'.repeat(90_000));
      expect([401, 422]).toContain(huge.status);
      expect(Date.now() - started).toBeLessThan(2000);
      expect((await fx.login(u.email, 'mật-khẩu-🔐-dài-đủ')).status).toBe(401);
      expect((await fx.login(u.email, `Abc\u0000def-password`)).status).toBe(422);
      // Over the body limit: refused before any parsing
      expect((await fx.login(u.email, 'x'.repeat(1024 * 1024))).status).toBe(413);
    });

    it('E-AUTH-03 20 parallel failures miss no count: the account locks', async () => {
      const u = await fx.user();
      const results = await Promise.all(Array.from({ length: 20 }, () => fx.login(u.email, WRONG)));
      expect(results.every((r) => r.status === 401)).toBe(true);
      const [row] = await fx.sql<{ locked_until: Date | null }>('SELECT locked_until FROM users WHERE id = $1', [u.id]);
      expect(row.locked_until).not.toBeNull();
      expect((await fx.login(u.email)).status).toBe(401);
      expect(await waitForMails(u.email)).toHaveLength(1);
    });

    it('E-AUTH-04 right password just after the lock ended opens the account; a failure then starts a new count', async () => {
      const u = await fx.user();
      for (let i = 0; i < 5; i++) await fx.login(u.email, WRONG);
      await fx.sql(`UPDATE users SET locked_until = (now() AT TIME ZONE 'UTC') - interval '1 millisecond' WHERE id = $1`, [u.id]);
      expect((await fx.login(u.email, WRONG)).status).toBe(401);
      const [row] = await fx.sql<{ failed_login_count: number; locked_until: Date | null }>(
        'SELECT failed_login_count, locked_until FROM users WHERE id = $1',
        [u.id],
      );
      expect(row).toEqual({ failed_login_count: 1, locked_until: null });
      expect((await fx.login(u.email)).status).toBe(200);
    });

    it('E-AUTH-05 alg:none, bad signature, edited payload, expired, missing claims: 401, never 500', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const [header, payload, signature] = access.split('.');
      const claims = decodeJwt(access);
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const secret = process.env.JWT_SECRET!;
      const sign = (body: object, expiresIn: number) =>
        new JwtService({ secret }).sign(body, { expiresIn, issuer: claims.iss as string, audience: claims.aud as string });
      const { exp: _exp, iat: _iat, iss: _iss, aud: _aud, ...rest } = claims;
      const bad = [
        `${encode({ alg: 'none', typ: 'JWT' })}.${payload}.`,
        `${header}.${payload}.${signature.slice(0, -4)}AAAA`,
        `${header}.${encode({ ...claims, sub: fx.companyA })}.${signature}`,
        sign(rest, -60),
        sign({ sub: u.id, typ: 'tenant', tid: claims.tid }, 60),
      ];
      for (const token of bad) expect((await call('get', '/api/v1/auth/me', { token })).status).toBe(401);
    });

    it('E-AUTH-06 token of a deleted user or a deleted tenant: 401', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      await fx.sql('DELETE FROM users WHERE id = $1', [u.id]);
      await fx.app.get(ControlEventsService).publish({ kind: 'user', tenantId, userId: u.id });
      await new Promise((r) => setTimeout(r, 200));
      expect((await call('get', '/api/v1/auth/me', { token: access })).status).toBe(401);

      const gone = new TenantFixture(uniqueSubdomain('gone'));
      gone.app = fx.app;
      gone.api = fx.api;
      const created = await fx.api.createTenant(fx.platform, gone.sub);
      const token = await fx.api.adminLogin(gone.sub);
      for (const status of ['SUSPENDED', 'DELETED']) {
        await fx.api.call('patch', `/platform/api/v1/tenants/${created.id}/status`, {
          token: fx.platform,
          body: { status, confirm_name: `Tenant ${gone.sub}` },
        });
      }
      expect((await gone.call('get', '/api/v1/auth/me', { token })).status).toBe(401);
      expect((await fx.api.call('get', '/api/v1/auth/me', { token })).status).toBe(401);
    });

    it('E-AUTH-07 malformed, multiple or very long Authorization headers: 401', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      for (const value of [access, `Basic ${access}`, `Bearer ${access} ${access}`, 'Bearer', `Bearer ${'a'.repeat(4000)}`]) {
        expect((await call('get', '/api/v1/auth/me', { headers: { Authorization: value } })).status).toBe(401);
      }
    });

    it('E-AUTH-08 a token issued slightly in the future (clock skew between pods) is accepted', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const claims = decodeJwt(access);
      const { exp: _exp, iat: _iat, iss, aud, ...rest } = claims;
      const skewed = new JwtService({ secret: process.env.JWT_SECRET! }).sign(
        { ...rest, iat: Math.floor(Date.now() / 1000) + 20 },
        { expiresIn: 900, issuer: iss as string, audience: aud as string },
      );
      expect((await call('get', '/api/v1/auth/me', { token: skewed })).status).toBe(200);
      const late = new JwtService({ secret: process.env.JWT_SECRET! }).sign(
        { ...rest, iat: Math.floor(Date.now() / 1000) - 910, exp: Math.floor(Date.now() / 1000) - 10 },
        { issuer: iss as string, audience: aud as string },
      );
      expect((await call('get', '/api/v1/auth/me', { token: late })).status).toBe(200);
    });
  });

  describe('password', () => {
    const forgot = (email: string, opts: Parameters<TenantFixture['call']>[2] = {}) =>
      call('post', '/api/v1/auth/password/forgot', { body: { email }, ...opts });
    const reset = (token: string, new_password = NEW_PASSWORD) =>
      call('post', '/api/v1/auth/password/reset', { body: { token, new_password } });

    it('BE-F02-20 known and unknown address: same 202; only the known one gets a mail', async () => {
      const u = await fx.user();
      const unknown = fx.email('nobody');
      const [a, b] = [await forgot(u.email), await forgot(unknown)];
      expect([a.status, b.status]).toEqual([202, 202]);
      expect(a.body).toEqual(b.body);
      await waitForMails(u.email);
      expect(await mailsTo(unknown)).toHaveLength(0);
    });

    it('BE-F02-21 the link works once; the token is stored hashed', async () => {
      const u = await fx.user();
      await forgot(u.email);
      const token = tokenIn((await waitForMails(u.email))[0]);
      const rows = await fx.sql<{ token_hash: string }>('SELECT token_hash FROM password_resets WHERE user_id = $1', [u.id]);
      expect(rows[0].token_hash).toBe(hash(token));
      expect((await reset(token)).status).toBe(204);
      expect((await reset(token, 'Another-New-Password-1')).status).toBe(400);
      expect((await fx.login(u.email, NEW_PASSWORD)).status).toBe(200);
    });

    it('BE-F02-22 a link older than 60 minutes is refused; a fresh one lasts 60 minutes', async () => {
      const u = await fx.user();
      await forgot(u.email);
      const token = tokenIn((await waitForMails(u.email))[0]);
      const [{ minutes }] = await fx.sql<{ minutes: string }>(
        `SELECT round(extract(epoch from expires_at - created_at) / 60) AS minutes FROM password_resets WHERE user_id = $1`,
        [u.id],
      );
      expect(Number(minutes)).toBe(60);
      await fx.sql(`UPDATE password_resets SET expires_at = (now() AT TIME ZONE 'UTC') - interval '1 second' WHERE user_id = $1`, [u.id]);
      expect((await reset(token)).status).toBe(400);
    });

    it('BE-F02-23 a successful reset revokes every session', async () => {
      const u = await fx.user();
      const s1 = await fx.session(u.email);
      const s2 = await fx.session(u.email);
      await forgot(u.email);
      expect((await reset(tokenIn((await waitForMails(u.email))[0]))).status).toBe(204);
      for (const s of [s1, s2]) {
        expect((await call('get', '/api/v1/auth/me', { token: s.access })).status).toBe(401);
        expect((await fx.refresh(s.refresh)).status).toBe(401);
      }
    });

    it('BE-F02-24 /me/password: wrong current is 422; right changes it and revokes the other sessions only', async () => {
      const u = await fx.user();
      const s1 = await fx.session(u.email);
      const s2 = await fx.session(u.email);
      const change = (current_password: string) =>
        call('post', '/api/v1/me/password', { token: s1.access, body: { current_password, new_password: NEW_PASSWORD } });
      expect((await change(WRONG)).status).toBe(422);
      expect((await change(USER_PASSWORD)).status).toBe(204);
      expect((await call('get', '/api/v1/auth/me', { token: s1.access })).status).toBe(200);
      expect((await call('get', '/api/v1/auth/me', { token: s2.access })).status).toBe(401);
      expect((await fx.refresh(s2.refresh)).status).toBe(401);
      expect((await fx.login(u.email, NEW_PASSWORD)).status).toBe(200);
    });

    it('E-MFA-04 BE-F02-24 a stolen session cannot guess through /me/password: 5 wrong lock it, the right one is then refused', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const change = (current_password: string) =>
        call('post', '/api/v1/me/password', { token: access, body: { current_password, new_password: NEW_PASSWORD } });
      for (let i = 0; i < 5; i++) expect((await change(WRONG)).status).toBe(422);
      const right = await change(USER_PASSWORD);
      expect(right.status).toBe(422);
      expect(right.body.fields[0].field).toBe('current_password');
      expect(await fx.auditActions(u.id)).toEqual(expect.arrayContaining(['auth.password_check_failed', 'auth.account_locked']));
      expect(await waitForMails(u.email)).toHaveLength(1);

      expect((await fx.login(u.email)).status).toBe(401);
      await fx.sql(`UPDATE users SET locked_until = (now() AT TIME ZONE 'UTC') - interval '1 second' WHERE id = $1`, [u.id]);
      expect((await fx.login(u.email, NEW_PASSWORD)).status).toBe(401);
      expect((await fx.login(u.email, USER_PASSWORD)).status).toBe(200);
    });

    it('E-MFA-04 BE-F02-24 20 guesses at once through /me/password test only 5', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          call('post', '/api/v1/me/password', { token: access, body: { current_password: WRONG, new_password: NEW_PASSWORD } }),
        ),
      );
      expect(results.every((r) => r.status === 422)).toBe(true);
      const tested = await fx.sql(`SELECT id FROM audit_logs WHERE action = 'auth.password_check_failed' AND entity_id = $1`, [u.id]);
      expect(tested).toHaveLength(5);
    });

    it('BE-F02-25 a weak password at reset is 422 and the token still works', async () => {
      const u = await fx.user();
      await forgot(u.email);
      const token = tokenIn((await waitForMails(u.email))[0]);
      expect((await reset(token, 'short')).status).toBe(422);
      expect((await reset(token)).status).toBe(204);
    });

    it('E-PWD-01 a second request kills the first link', async () => {
      const u = await fx.user();
      await forgot(u.email);
      const first = tokenIn((await waitForMails(u.email))[0]);
      await forgot(u.email);
      const second = tokenIn((await waitForMails(u.email, 2)).find((m) => tokenIn(m) !== first)!);
      expect((await reset(first)).status).toBe(400);
      expect((await reset(second)).status).toBe(204);
    });

    it('E-PWD-02 disabled or invited: 202 and no link', async () => {
      const disabled = await fx.user();
      await call('patch', `/api/v1/users/${disabled.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } });
      const invited = fx.email('inv');
      await call('post', '/api/v1/users/invitations', {
        token: fx.admin,
        body: { email: invited, full_name: 'I', memberships: [{ company_id: fx.companyA, role_id: fx.roles.sales }] },
      });
      const before = (await waitForMails(invited)).length;
      expect((await forgot(disabled.email)).status).toBe(202);
      expect((await forgot(invited)).status).toBe(202);
      await new Promise((r) => setTimeout(r, 1000));
      expect(await mailsTo(disabled.email)).toHaveLength(0);
      expect(await mailsTo(invited)).toHaveLength(before);
    });

    it('E-PWD-03 the same token twice in parallel: exactly one succeeds', async () => {
      const u = await fx.user();
      await forgot(u.email);
      const token = tokenIn((await waitForMails(u.email))[0]);
      const results = await Promise.all([reset(token), reset(token, 'Second-New-Password-2')]);
      expect(results.map((r) => r.status).sort()).toEqual([204, 400]);
    });

    it('E-PWD-04 the link of one tenant on the domain of another is refused', async () => {
      const u = await fx.user();
      await forgot(u.email);
      const token = tokenIn((await waitForMails(u.email))[0]);
      expect((await other.call('post', '/api/v1/auth/password/reset', { body: { token, new_password: NEW_PASSWORD } })).status).toBe(400);
      expect((await reset(token)).status).toBe(204);
    });

    it('E-PWD-05 forged Host port and X-Forwarded-Host: the link comes from configuration only', async () => {
      const u = await fx.user();
      await forgot(u.email, {
        host: `${fx.sub}.localhost:9999`,
        headers: { 'X-Forwarded-Host': 'evil.example', Forwarded: 'host=evil.example' },
      });
      const [mail] = await waitForMails(u.email);
      expect(mail.Text).toContain(`http://${fx.sub}.compta.test/reset-password?token=`);
      expect(mail.Text + mail.HTML).not.toMatch(/evil\.example|:9999/);
    });

    it('E-PWD-06 the current password as the new one: 422 PASSWORD_REUSED, at change and at reset', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const change = await call('post', '/api/v1/me/password', {
        token: access,
        body: { current_password: USER_PASSWORD, new_password: USER_PASSWORD },
      });
      expect(change.status).toBe(422);
      expect(change.body.code).toBe('PASSWORD_REUSED');
      await forgot(u.email);
      const res = await reset(tokenIn((await waitForMails(u.email))[0]), USER_PASSWORD);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('PASSWORD_REUSED');
    });

    it('E-PWD-07 no reset token in the audit log', async () => {
      const u = await fx.user();
      await forgot(u.email);
      const token = tokenIn((await waitForMails(u.email))[0]);
      await reset(token);
      const rows = await fx.sql('SELECT * FROM audit_logs WHERE entity_id = $1', [u.id]);
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toContain(token);
      expect(JSON.stringify(rows)).not.toContain(hash(token));
    });
  });

  describe('2FA', () => {
    const verify = (mfa_token: string, code: string, opts: Parameters<TenantFixture['call']>[2] = {}) =>
      call('post', '/api/v1/auth/mfa/verify', { body: { mfa_token, code }, ...opts });
    const startMfa = async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const mfa = await fx.enableMfa(access);
      return { u, access, ...mfa };
    };
    const allowAnyStep = (userId: string) => fx.sql('UPDATE user_mfa SET last_used_step = NULL WHERE user_id = $1', [userId]);

    it('BE-F02-30 setup gives secret, QR and recovery codes; the secret is encrypted and the codes hashed in the DB', async () => {
      const { u, setup, secret, recoveryCodes } = await startMfa();
      expect(secret).toMatch(/^[A-Z2-7]+$/);
      expect(setup.otpauth_url).toContain('otpauth://totp/');
      expect(setup.qr_code).toMatch(/^data:image\/png;base64,/);
      expect(recoveryCodes).toHaveLength(10);
      const [mfa] = await fx.sql<{ totp_secret_enc: string }>('SELECT totp_secret_enc FROM user_mfa WHERE user_id = $1', [u.id]);
      expect(mfa.totp_secret_enc).not.toContain(secret);
      const codes = await fx.sql<{ code_hash: string }>('SELECT code_hash FROM mfa_recovery_codes WHERE user_id = $1', [u.id]);
      expect(codes.map((c) => c.code_hash).sort()).toEqual(recoveryCodes.map(hash).sort());
    });

    it('BE-F02-31 E-MFA-03 with 2FA, login only gives mfa_required; that token opens nothing and only on its tenant', async () => {
      const { u, secret } = await startMfa();
      const res = await fx.login(u.email);
      expect(res.status).toBe(200);
      expect(res.body.mfa_required).toBe(true);
      expect(res.body.access_token).toBeUndefined();
      expect(res.body.refresh_token).toBeUndefined();
      const token = res.body.mfa_token as string;
      expect((await call('get', '/api/v1/customers', { token, company: fx.companyA })).status).toBe(401);
      expect((await call('get', '/api/v1/auth/me', { token })).status).toBe(401);
      expect((await other.call('post', '/api/v1/auth/mfa/verify', { body: { mfa_token: token, code: totp(secret, 1) } })).status).toBe(401);
    });

    it('BE-F02-32 code now and at +/-1 step pass; +/-2 steps and a wrong code fail with the same message', async () => {
      const { u, secret } = await startMfa();
      const attempt = async (code: string) => {
        await allowAnyStep(u.id);
        return verify((await fx.login(u.email)).body.mfa_token, code);
      };
      for (const offset of [0, 1, -1]) expect((await attempt(totp(secret, offset))).status).toBe(200);
      const refused = [await attempt(totp(secret, 2)), await attempt(totp(secret, -2)), await attempt('000000')];
      for (const r of refused) {
        expect(r.status).toBe(401);
        expect(r.body.code).toBe('MFA_INVALID_CODE');
        expect(r.body.message).toBe(refused[0].body.message);
      }
    });

    it('BE-F02-34 E-MFA-05 a recovery code works once; with all of them gone there is no way in', async () => {
      const { u, recoveryCodes } = await startMfa();
      const token = () => fx.login(u.email).then((r) => r.body.mfa_token as string);
      const res = await verify(await token(), recoveryCodes[0]);
      expect(res.status).toBe(200);
      expect((await verify(await token(), recoveryCodes[0])).status).toBe(401);
      await fx.sql(`UPDATE mfa_recovery_codes SET used_at = now() WHERE user_id = $1`, [u.id]);
      expect((await verify(await token(), recoveryCodes[1])).status).toBe(401);
    });

    it('BE-F02-38 with MFA_ENFORCED=false nobody is forced: a default 123456 admin works without 2FA', async () => {
      const res = await fx.api.call('post', '/api/v1/auth/login', {
        host: 'dfm.localhost',
        body: { email: 'admin@dfm.local', password: DEFAULT_PASSWORD },
      });
      expect(res.status).toBe(200);
      expect(res.body.mfa_required).toBe(false);
      expect(res.body.mfa_setup_required).toBe(false);
      expect((await fx.api.call('get', '/api/v1/companies', { host: 'dfm.localhost', token: res.body.access_token })).status).toBe(200);
    });

    it('E-MFA-03 an expired second-step token is refused, with the right code', async () => {
      const { u, secret } = await startMfa();
      const token = (await fx.login(u.email)).body.mfa_token as string;
      const { exp: _exp, iat: _iat, iss, aud, ...rest } = decodeJwt(token);
      const expired = new JwtService({ secret: process.env.JWT_SECRET! }).sign(rest, {
        expiresIn: -60,
        issuer: iss as string,
        audience: aud as string,
      });
      expect((await verify(expired, totp(secret, 1))).status).toBe(401);
      expect((await verify(token, totp(secret, 1))).status).toBe(200);
    });

    it('BE-F02-39 E-MFA-05 an admin resets a user 2FA, with audit; someone without user.manage gets 403', async () => {
      const { u } = await startMfa();
      const sales = await fx.user();
      const { access } = await fx.session(sales.email);
      expect((await call('post', `/api/v1/users/${u.id}/mfa/reset`, { token: access })).status).toBe(403);
      expect((await call('post', `/api/v1/users/${u.id}/mfa/reset`, { token: fx.admin })).status).toBe(204);
      expect(await fx.auditActions(u.id)).toContain('user.mfa_reset');
      const login = await fx.login(u.email);
      expect(login.body.mfa_required).toBe(false);
      expect(login.body.access_token).toEqual(expect.any(String));
    });

    it('E-MFA-01 the same TOTP code cannot be used twice in its time window', async () => {
      const { u, secret } = await startMfa();
      const code = totp(secret, 1);
      expect((await verify((await fx.login(u.email)).body.mfa_token, code)).status).toBe(200);
      expect((await verify((await fx.login(u.email)).body.mfa_token, code)).status).toBe(401);
    });

    it('E-MFA-02 setup without confirming leaves 2FA off; a second setup replaces the secret', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const first = await call('post', '/api/v1/me/mfa/setup', { token: access });
      const second = await call('post', '/api/v1/me/mfa/setup', { token: access });
      expect(second.body.secret).not.toBe(first.body.secret);
      const login = await fx.login(u.email);
      expect(login.body.mfa_required).toBe(false);
      expect((await call('post', '/api/v1/me/mfa/confirm', { token: access, body: { code: totp(first.body.secret) } })).status).toBe(422);
      expect((await call('post', '/api/v1/me/mfa/confirm', { token: access, body: { code: totp(second.body.secret) } })).status).toBe(200);
    });

    it('E-MFA-04 wrong codes count toward the lock, on one token', async () => {
      const { u, secret } = await startMfa();
      const token = (await fx.login(u.email)).body.mfa_token as string;
      for (let i = 0; i < 5; i++) expect((await verify(token, '000000')).status).toBe(401);
      expect((await verify(token, totp(secret, 1))).status).toBe(401);
      expect((await fx.login(u.email)).status).toBe(401);
    });

    it('E-MFA-04 logging in again with the right password buys no more guesses: the lock comes at 5 wrong codes in total', async () => {
      const { u, secret } = await startMfa();
      let wrong = 0;
      let lastToken = '';
      for (let round = 0; round < 3; round++) {
        const login = await fx.login(u.email);
        if (login.status !== 200) break;
        expect(login.body.mfa_required).toBe(true);
        lastToken = login.body.mfa_token;
        for (let i = 0; i < 4 && wrong < 5; i++) {
          expect((await verify(lastToken, '000000')).status).toBe(401);
          wrong++;
        }
      }
      expect(wrong).toBe(5);

      const locked = await fx.login(u.email);
      expect(locked.status).toBe(401);
      expect(locked.body.code).toBe('INVALID_CREDENTIALS');
      expect((await verify(lastToken, totp(secret, 1))).status).toBe(401);
      const [row] = await fx.sql<{ locked_until: Date | null }>('SELECT locked_until FROM users WHERE id = $1', [u.id]);
      expect(row.locked_until).not.toBeNull();
      expect(await waitForMails(u.email)).toHaveLength(1);
    });

    it('E-MFA-04 limit per user: 20 codes at once from 20 addresses test only 5, and the right code is then refused', async () => {
      const { u, secret } = await startMfa();
      const token = (await fx.login(u.email)).body.mfa_token as string;
      const attempts = Array.from({ length: 20 }, (_, i) =>
        verify(token, '000000', {
          headers: { 'X-Client-Ip': `10.20.0.${i + 1}`, 'X-Internal-Proxy-Secret': process.env.INTERNAL_PROXY_SECRET! },
        }),
      );
      const results = await Promise.all(attempts);
      expect(results.every((r) => r.status === 401)).toBe(true);
      const tested = await fx.sql(`SELECT id FROM audit_logs WHERE action = 'auth.login_failed' AND entity_id = $1`, [u.id]);
      expect(tested).toHaveLength(5);
      expect((await verify(token, totp(secret, 1))).status).toBe(401);
    });

    it('E-MFA-04 BE-F02-04 only passing both steps clears the counter', async () => {
      const { u, secret } = await startMfa();
      const count = async () =>
        (await fx.sql<{ failed_login_count: number }>('SELECT failed_login_count FROM users WHERE id = $1', [u.id]))[0].failed_login_count;
      const token = (await fx.login(u.email)).body.mfa_token as string;
      for (let i = 0; i < 4; i++) await verify(token, '000000');
      expect(await count()).toBe(4);

      const again = await fx.login(u.email);
      expect(again.body.mfa_required).toBe(true);
      expect(await count()).toBe(4);

      expect((await verify(again.body.mfa_token, totp(secret, 1))).status).toBe(200);
      expect(await count()).toBe(0);
    });

    it('E-MFA-04 a stolen session cannot guess through /me/mfa/disable: wrong code or password count, then the right ones are refused', async () => {
      const { u, access, secret } = await startMfa();
      const disable = (password: string, code: string) =>
        call('post', '/api/v1/me/mfa/disable', { token: access, body: { password, code } });
      for (let i = 0; i < 3; i++) expect((await disable(USER_PASSWORD, '000000')).status).toBe(422);
      for (let i = 0; i < 2; i++) expect((await disable(WRONG, totp(secret, 1))).status).toBe(422);

      const [row] = await fx.sql<{ locked_until: Date | null; mfa_enabled: boolean }>(
        'SELECT locked_until, mfa_enabled FROM users WHERE id = $1',
        [u.id],
      );
      expect(row.locked_until).not.toBeNull();
      expect((await disable(USER_PASSWORD, totp(secret, 1))).status).toBe(422);
      expect((await fx.sql<{ mfa_enabled: boolean }>('SELECT mfa_enabled FROM users WHERE id = $1', [u.id]))[0].mfa_enabled).toBe(true);
      expect(await fx.auditActions(u.id)).toEqual(expect.arrayContaining(['auth.mfa_disable_failed', 'auth.account_locked']));
      expect(await waitForMails(u.email)).toHaveLength(1);
      expect((await fx.login(u.email)).status).toBe(401);
    });

    it('E-MFA-05 last Admin without device or codes: the server procedure resets them, ends the sessions and leaves an audit row', async () => {
      const u = await fx.user('tenant_admin', null);
      const { access } = await fx.session(u.email);
      await fx.enableMfa(access);
      expect((await fx.login(u.email)).body.mfa_required).toBe(true);
      await resetUserMfa(fx.sub, u.email);
      await new Promise((r) => setTimeout(r, 300));
      expect((await call('get', '/api/v1/auth/me', { token: access })).status).toBe(401);
      expect((await fx.login(u.email)).body.mfa_required).toBe(false);
      const [row] = await fx.sql<{ actor_type: string }>(
        `SELECT actor_type FROM audit_logs WHERE action = 'user.mfa_reset' AND entity_id = $1`,
        [u.id],
      );
      expect(row.actor_type).toBe('system');
    });

    it('E-MFA-06 an admin cannot reset their own 2FA', async () => {
      const [me] = await fx.sql<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [`admin@${fx.sub}.test`]);
      const res = await call('post', `/api/v1/users/${me.id}/mfa/reset`, { token: fx.admin });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MFA_SELF_RESET_FORBIDDEN');
    });

    it('E-MFA-09 a code pasted with spaces is accepted', async () => {
      const { u, secret } = await startMfa();
      const code = totp(secret, 1);
      expect((await verify((await fx.login(u.email)).body.mfa_token, `${code.slice(0, 3)} ${code.slice(3)}`)).status).toBe(200);
    });
  });

  describe('unified login', () => {
    const unified = (body: object, opts: Parameters<TenantFixture['call']>[2] = {}) =>
      fx.api.call('post', '/api/v1/auth/unified-login', { body, ...opts });

    it('BE-F02-40 tenant workspace returns tokens, user, context, roles, permissions, version and modules', async () => {
      const u = await fx.user();
      const res = await unified({ email: u.email, password: USER_PASSWORD, workspace: { type: 'tenant', company_code: fx.sub } });
      expect(res.status).toBe(200);
      for (const key of ['access_token', 'refresh_token', 'user', 'context', 'roles', 'permissions', 'permissions_version', 'modules'])
        expect(res.body).toHaveProperty(key);
      expect(res.body.context).toEqual({ type: 'tenant', tenant_id: tenantId, company_code: fx.sub, default_company_id: fx.companyA });
      expect(res.body.roles).toEqual(['sales']);
      expect(res.body.modules[0]).toEqual(
        expect.objectContaining({ module: expect.any(String), visible: expect.any(Boolean), actions: expect.any(Object) }),
      );
    });

    it('BE-F02-41 missing workspace or company_code: 400, and it says nothing about the address', async () => {
      const u = await fx.user();
      const answers = [
        await unified({ email: u.email, password: USER_PASSWORD }),
        await unified({ email: fx.email('nobody'), password: USER_PASSWORD }),
        await unified({ email: u.email, password: USER_PASSWORD, workspace: { type: 'tenant' } }),
        await unified({ email: u.email, password: USER_PASSWORD, workspace: { type: 'other' } }),
      ];
      for (const a of answers) {
        expect(a.status).toBe(400);
        expect(a.body.message).toBe(answers[0].body.message);
      }
    });

    it('BE-F02-42 unknown code, suspended company, wrong password, locked user: the same 401', async () => {
      const u = await fx.user();
      const disabled = await fx.user();
      await call('patch', `/api/v1/users/${disabled.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } });
      const suspended = uniqueSubdomain('sus2');
      const created = await fx.api.createTenant(fx.platform, suspended);
      await fx.api.call('patch', `/platform/api/v1/tenants/${created.id}/status`, {
        token: fx.platform,
        body: { status: 'SUSPENDED', confirm_name: `Tenant ${suspended}` },
      });

      const answers = [
        await unified({ email: u.email, password: USER_PASSWORD, workspace: { type: 'tenant', company_code: 'no-such-code' } }),
        await unified({
          email: `admin@${suspended}.test`,
          password: ADMIN_PASSWORD,
          workspace: { type: 'tenant', company_code: suspended },
        }),
        await unified({ email: u.email, password: WRONG, workspace: { type: 'tenant', company_code: fx.sub } }),
        await unified({ email: disabled.email, password: USER_PASSWORD, workspace: { type: 'tenant', company_code: fx.sub } }),
      ];
      for (const a of answers) {
        expect(a.status).toBe(401);
        expect(a.body.code).toBe('INVALID_CREDENTIALS');
        expect(a.body.message).toBe(answers[0].body.message);
      }
    });

    it('BE-F02-43 a tenant_id sent by the client is ignored', async () => {
      const u = await fx.user();
      const otherId = (await withControl((c) => c.query('SELECT id FROM tenants WHERE subdomain = $1', [other.sub]))).rows[0].id;
      const res = await unified({
        email: u.email,
        password: USER_PASSWORD,
        tenant_id: otherId,
        workspace: { type: 'tenant', company_code: fx.sub, tenant_id: otherId },
      });
      expect(res.status).toBe(200);
      expect(res.body.context.tenant_id).toBe(tenantId);
    });

    it('BE-F02-44 tenant account in the platform workspace and the reverse: 401, no fallback to a default tenant', async () => {
      const u = await fx.user();
      expect((await unified({ email: u.email, password: USER_PASSWORD, workspace: { type: 'platform' } })).status).toBe(401);
      expect(
        (
          await unified({
            email: 'superadmin@platform.local',
            password: DEFAULT_PASSWORD,
            workspace: { type: 'tenant', company_code: fx.sub },
          })
        ).status,
      ).toBe(401);
      expect(
        (await unified({ email: 'admin@dfm.local', password: DEFAULT_PASSWORD, workspace: { type: 'tenant', company_code: fx.sub } }))
          .status,
      ).toBe(401);
    });

    it('BE-F02-45 on a subdomain, a different company_code is refused', async () => {
      const u = await fx.user();
      const res = await unified(
        { email: u.email, password: USER_PASSWORD, workspace: { type: 'tenant', company_code: other.sub } },
        { host: fx.host },
      );
      expect(res.status).toBe(401);
      expect(
        (await unified({ email: u.email, password: USER_PASSWORD, workspace: { type: 'tenant', company_code: fx.sub } }, { host: fx.host }))
          .status,
      ).toBe(200);
    });

    it('BE-F02-46 without subdomain a tenant token runs on its own tenant; a platform token on tenant routes is 401', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const res = await fx.api.call('get', '/api/v1/auth/me', { token: access });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(u.email);
      expect((await call('get', '/api/v1/auth/me', { token: fx.platform })).status).toBe(401);
      expect((await fx.api.call('get', '/api/v1/auth/me', { token: fx.platform })).status).toBe(401);
    });

    it('BE-F02-47 default company: the tenant default if the user has access, else the first they can reach', async () => {
      const inA = await fx.user('sales', fx.companyA);
      const inB = await fx.user('sales', fx.companyB);
      expect((await fx.session(inA.email)).body.context.default_company_id).toBe(fx.companyA);
      expect((await fx.session(inB.email)).body.context.default_company_id).toBe(fx.companyB);

      expect((await call('patch', '/api/v1/tenant/settings', { token: fx.admin, body: { default_company_id: fx.companyB } })).status).toBe(
        200,
      );
      await new Promise((r) => setTimeout(r, 200));
      const admin = await fx.login(`admin@${fx.sub}.test`, ADMIN_PASSWORD);
      expect(admin.body.context.default_company_id).toBe(fx.companyB);
      expect((await fx.session(inA.email)).body.context.default_company_id).toBe(fx.companyA);
      await call('patch', '/api/v1/tenant/settings', { token: fx.admin, body: { default_company_id: fx.companyA } });
      await new Promise((r) => setTimeout(r, 200));
    });

    it('BE-F02-48 /auth/me/permissions: no READ means not visible; actions and specialized are right', async () => {
      const role = await call('post', '/api/v1/roles', {
        token: fx.admin,
        body: {
          key: `custom_${Date.now().toString(36)}`,
          name: 'Write only',
          grants: [
            { resource: 'customer', action: 'write', scope: 'OWN' },
            { resource: 'product', action: 'read', scope: 'COMPANY' },
            { resource: 'product', action: 'manage', scope: 'COMPANY' },
            { resource: 'payment', action: 'record', scope: 'COMPANY' },
          ],
        },
      });
      expect(role.status).toBe(201);
      const email = fx.email('custom');
      await call('post', '/api/v1/users', {
        token: fx.admin,
        body: { email, full_name: 'C', password: USER_PASSWORD, memberships: [{ company_id: fx.companyA, role_id: role.body.id }] },
      });
      const { access } = await fx.session(email);
      const res = await call('get', '/api/v1/auth/me/permissions', { token: access, company: fx.companyA });
      expect(res.status).toBe(200);
      const module = (name: string) => res.body.modules.find((m: { module: string }) => m.module === name);
      expect(module('customer')).toMatchObject({ visible: false, actions: { read: false, create: true, update: true, delete: false } });
      expect(module('product')).toMatchObject({ visible: true, actions: { read: true, create: true, update: true, delete: true } });
      expect(module('payment')).toMatchObject({ visible: true, specialized: ['record'] });
      expect(module('audit')).toMatchObject({ visible: false, actions: { read: false, create: false, update: false, delete: false } });
    });

    it('BE-F02-50 PATCH /me changes name and language; a forbidden field is 422', async () => {
      const u = await fx.user();
      const { access } = await fx.session(u.email);
      const ok = await call('patch', '/api/v1/me', { token: access, body: { full_name: 'New Name', locale: 'vi' } });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ full_name: 'New Name', locale: 'vi' });
      for (const body of [{ status: 'DISABLED' }, { email: 'other@x.test' }, { password_hash: 'x' }, { token_version: 9 }]) {
        expect((await call('patch', '/api/v1/me', { token: access, body })).status).toBe(422);
      }
    });

    it('BE-F02-51 login right and wrong, password change, 2FA on and off are audited with IP and user-agent, without secrets', async () => {
      const u = await fx.user();
      const headers = { 'User-Agent': 'audit-agent/1.0' };
      await fx.login(u.email, WRONG, { headers });
      const s = await fx.login(u.email, USER_PASSWORD, { headers });
      const access = s.body.access_token as string;
      await call('post', '/api/v1/me/password', { token: access, body: { current_password: USER_PASSWORD, new_password: NEW_PASSWORD } });
      const { secret } = await fx.enableMfa(access);
      await new Promise((r) => setTimeout(r, 200));
      await fx.sql('UPDATE user_mfa SET last_used_step = NULL WHERE user_id = $1', [u.id]);
      const off = await call('post', '/api/v1/me/mfa/disable', { token: access, body: { password: NEW_PASSWORD, code: totp(secret) } });
      expect(off.status).toBe(204);

      const rows = await fx.sql<{ action: string; ip: string | null; user_agent: string | null }>(
        `SELECT * FROM audit_logs WHERE user_id = $1 AND action LIKE 'auth.%'`,
        [u.id],
      );
      const actions = rows.map((r) => r.action);
      for (const action of ['auth.login_failed', 'auth.login', 'auth.password_changed', 'auth.mfa_enabled', 'auth.mfa_disabled'])
        expect(actions).toContain(action);
      const failed = rows.find((r) => r.action === 'auth.login_failed')!;
      expect(failed.ip).toBeTruthy();
      expect(failed.user_agent).toBe('audit-agent/1.0');
      const text = JSON.stringify(rows);
      for (const secretValue of [WRONG, USER_PASSWORD, NEW_PASSWORD, secret, access, s.body.refresh_token])
        expect(text).not.toContain(secretValue);
    });
  });
});
