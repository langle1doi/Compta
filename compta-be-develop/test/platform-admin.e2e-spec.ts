import { NestExpressApplication } from '@nestjs/platform-express';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { sign } from 'jsonwebtoken';
import { IS_PUBLIC, PLATFORM_AUTH_ONLY, PLATFORM_ONLY, PLATFORM_PERMISSION } from '../src/common/auth/auth.decorators';
import { PLATFORM_OPERATOR, PLATFORM_ROLES, PLATFORM_SUPER_ADMIN, PLATFORM_SUPPORT } from '../src/modules/rbac/platform-catalog';
import { Api, createTestApp, hostOf, uniqueSubdomain } from './support/app';
import { withControl } from './support/db';

const PASSWORD = 'Platform-Admin-2026';
const unique = (label: string) => `${label}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}@platform.test`;

describe('Platform: accounts, roles, sessions, audit (F01)', () => {
  let app: NestExpressApplication;
  let api: Api;
  let root: string;
  let roleIds: Record<string, string>;

  const createAdmin = async (roleKey: string, email = unique('admin')) => {
    const res = await api.call('post', '/platform/api/v1/users', {
      token: root,
      body: { email, full_name: 'Admin', password: PASSWORD, role_id: roleIds[roleKey] },
    });
    if (res.status !== 201) throw new Error(`create admin failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as { id: string; email: string };
  };
  const loginBody = async (email: string, password = PASSWORD) => {
    const res = await api.call('post', '/platform/api/v1/auth/login', { body: { email, password } });
    if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as { access_token: string; refresh_token: string };
  };
  const auditRows = async (action: string, targetId?: string) =>
    (
      await withControl((c) =>
        c.query('SELECT * FROM platform_audit_logs WHERE action = $1 AND ($2::text IS NULL OR target_id = $2) ORDER BY id', [
          action,
          targetId ?? null,
        ]),
      )
    ).rows;
  const superAdmins = () =>
    withControl((c) =>
      c.query(
        `SELECT a.id FROM platform_admins a JOIN platform_roles r ON r.id = a.role_id WHERE r.key = 'PLATFORM_SUPER_ADMIN' AND a.status = 'ACTIVE'`,
      ),
    );

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    root = await api.platformToken();
    const roles = await api.call('get', '/platform/api/v1/roles', { token: root });
    expect(roles.status).toBe(200);
    roleIds = Object.fromEntries(roles.body.map((r: { key: string; id: string }) => [r.key, r.id]));
  });
  afterAll(() => app.close());

  describe('BE-F01-21: role x route matrix', () => {
    const FAKE = '00000000-0000-4000-8000-000000000000';
    // [method, path, body, super, operator, support]: allowed or not. Allowed means "got past the guard" (anything but 403).
    const ROUTES: [string, string, object | undefined, boolean, boolean, boolean][] = [
      ['get', '/platform/api/v1/tenants', undefined, true, true, true],
      ['get', `/platform/api/v1/tenants/${FAKE}`, undefined, true, true, true],
      ['post', '/platform/api/v1/tenants', {}, true, true, false],
      ['post', `/platform/api/v1/tenants/${FAKE}/retry`, {}, true, true, false],
      ['patch', `/platform/api/v1/tenants/${FAKE}/status`, { status: 'ACTIVE' }, true, true, false],
      ['get', '/platform/api/v1/users', undefined, true, false, false],
      ['get', `/platform/api/v1/users/${FAKE}`, undefined, true, false, false],
      ['post', '/platform/api/v1/users', {}, true, false, false],
      ['patch', `/platform/api/v1/users/${FAKE}`, {}, true, false, false],
      ['patch', `/platform/api/v1/users/${FAKE}/status`, { status: 'ACTIVE' }, true, false, false],
      ['get', '/platform/api/v1/roles', undefined, true, false, false],
      ['get', '/platform/api/v1/audit-logs', undefined, true, false, false],
      ['post', `/platform/api/v1/tenants/${FAKE}/resend-invite`, undefined, true, true, false],
      ['patch', `/platform/api/v1/tenants/${FAKE}/plan`, { plan_id: FAKE }, true, true, false],
      ['get', '/platform/api/v1/plans', undefined, true, true, true],
      ['get', `/platform/api/v1/plans/${FAKE}`, undefined, true, true, true],
      ['post', '/platform/api/v1/plans', {}, true, true, false],
      ['patch', `/platform/api/v1/plans/${FAKE}`, {}, true, true, false],
      ['delete', `/platform/api/v1/plans/${FAKE}`, undefined, true, true, false],
      ['get', '/platform/api/v1/jobs', undefined, true, true, true],
      ['get', `/platform/api/v1/jobs/${FAKE}`, undefined, true, true, true],
      ['get', '/platform/api/v1/migrations', undefined, true, true, true],
      ['post', '/platform/api/v1/migrations/run', { target_version: 'refused' }, true, true, false],
      ['post', `/platform/api/v1/tenants/${FAKE}/export`, undefined, true, false, false],
      ['get', `/platform/api/v1/tenants/${FAKE}/export`, undefined, true, false, false],
      ['get', `/platform/api/v1/tenants/${FAKE}/export/${FAKE}`, undefined, true, false, false],
      ['get', `/platform/api/v1/tenants/${FAKE}/support-sessions`, undefined, true, false, false],
      ['post', `/platform/api/v1/tenants/${FAKE}/support-sessions/enter`, undefined, true, false, false],
    ];
    let tokens: Record<string, string>;

    beforeAll(async () => {
      const [operator, support] = [await createAdmin(PLATFORM_OPERATOR), await createAdmin(PLATFORM_SUPPORT)];
      tokens = {
        [PLATFORM_SUPER_ADMIN]: root,
        [PLATFORM_OPERATOR]: (await loginBody(operator.email)).access_token,
        [PLATFORM_SUPPORT]: (await loginBody(support.email)).access_token,
      };
    });

    it.each(ROUTES)('%s %s', async (method, path, body, ...allowed) => {
      const roles = [PLATFORM_SUPER_ADMIN, PLATFORM_OPERATOR, PLATFORM_SUPPORT];
      for (const [i, role] of roles.entries()) {
        const res = await api.call(method as 'get', path, { token: tokens[role], body });
        if (allowed[i]) expect([role, res.status]).not.toEqual([role, 403]);
        else expect([role, res.status, res.body.code]).toEqual([role, 403, 'PERMISSION_DENIED']);
      }
    });

    it('every platform route says what it needs: a permission, "any admin", or public for the three auth routes', () => {
      const undeclared: string[] = [];
      const open: string[] = [];
      const checked: string[] = [];
      for (const moduleRef of app.get(ModulesContainer).values()) {
        for (const wrapper of moduleRef.controllers.values()) {
          const metatype = wrapper.metatype as unknown as { name: string; prototype: object };
          const prototype = metatype.prototype;
          const base = String(Reflect.getMetadata(PATH_METADATA, metatype));
          if (!base.startsWith('platform/')) continue;
          for (const name of Object.getOwnPropertyNames(prototype).filter((n) => n !== 'constructor')) {
            const handler = (prototype as Record<string, object>)[name];
            if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
            const route = `${metatype.name}.${name}`;
            checked.push(route);
            const has = (key: string) => Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, metatype);
            if (has(IS_PUBLIC)) open.push(route);
            else if (!has(PLATFORM_ONLY) || (!has(PLATFORM_PERMISSION) && !has(PLATFORM_AUTH_ONLY))) undeclared.push(route);
          }
        }
      }
      expect(checked.length).toBeGreaterThan(25);
      expect(undeclared).toEqual([]);
      expect(open.sort()).toEqual(['PlatformAuthController.login', 'PlatformAuthController.logout', 'PlatformAuthController.refresh']);
    });

    it('seeds exactly the three roles; only the Super Admin has a default account; no wildcard grant exists', async () => {
      const roles = await api.call('get', '/platform/api/v1/roles', { token: root });
      expect(roles.body.map((r: { key: string }) => r.key).sort()).toEqual(PLATFORM_ROLES.map((r) => r.key).sort());
      const flat = roles.body.flatMap((r: { permissions: { resource: string; action: string }[] }) => r.permissions);
      expect(flat.filter((p: { resource: string; action: string }) => p.resource === '*' || p.action === '*')).toEqual([]);
      const { rows } = await withControl((c) => c.query(`SELECT email FROM platform_admins WHERE email LIKE '%@platform.local'`));
      expect(rows.map((r) => r.email)).toEqual(['superadmin@platform.local']);
    });

    it('me returns role, permissions and modules; Support sees no write action', async () => {
      const me = await api.call('get', '/platform/api/v1/auth/me', { token: tokens[PLATFORM_SUPPORT] });
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ context: { type: 'platform' }, roles: [PLATFORM_SUPPORT], permissions_version: 1 });
      expect(me.body.permissions).toEqual(['job.read', 'migration.read', 'plan.read', 'tenant.read']);
      expect(me.body.modules.find((m: { module: string }) => m.module === 'tenant')).toMatchObject({
        visible: true,
        actions: { read: true, create: false, update: false, delete: false },
      });
      expect(JSON.stringify(me.body)).not.toMatch(/password|hash/i);
    });
  });

  describe('accounts', () => {
    it('E-PLAT-03: an email differing only by case is a duplicate, 422 EMAIL_TAKEN; stored lowercase', async () => {
      const email = unique('Case').toLowerCase();
      await createAdmin(PLATFORM_SUPPORT, email);
      const res = await api.call('post', '/platform/api/v1/users', {
        token: root,
        body: { email: email.toUpperCase(), full_name: 'X', password: PASSWORD, role_id: roleIds[PLATFORM_SUPPORT] },
      });
      expect(res.status).toBe(422);
      expect(res.body.fields).toEqual([expect.objectContaining({ field: 'email', code: 'EMAIL_TAKEN' })]);
      await expect(loginBody(email.toUpperCase())).resolves.toMatchObject({ access_token: expect.any(String) });
    });

    it('E-API-03/E-API-04: extra fields, weak password, unknown role, NUL byte: 422, never 500', async () => {
      const base = { email: unique('v'), full_name: 'X', password: PASSWORD, role_id: roleIds[PLATFORM_SUPPORT] };
      for (const body of [
        { ...base, status: 'ACTIVE' },
        { ...base, password: 'short' },
        { ...base, role_id: '00000000-0000-4000-8000-000000000000' },
        { ...base, full_name: 'a\u0000b' },
      ]) {
        const res = await api.call('post', '/platform/api/v1/users', { token: root, body });
        expect([JSON.stringify(body), res.status]).toEqual([JSON.stringify(body), 422]);
      }
      const nul = await api.call('get', `/platform/api/v1/users?keyword=${encodeURIComponent('a\u0000b')}`, { token: root });
      expect(nul.status).toBe(422);
      expect((await api.call('get', '/platform/api/v1/users?page=0', { token: root })).status).toBe(422);
      expect((await api.call('get', '/platform/api/v1/users?page_size=100000', { token: root })).status).toBe(422);
      expect((await api.call('get', '/platform/api/v1/users/not-a-uuid', { token: root })).status).toBe(400);
    });

    it('never returns the password hash; lists with pagination', async () => {
      const res = await api.call('get', '/platform/api/v1/users?page=1&page_size=2', { token: root });
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(res.body)).not.toMatch(/password|token_version/i);
    });

    it('E-PLAT-02: downgrading a logged-in admin applies on the next request, with the same token', async () => {
      const admin = await createAdmin(PLATFORM_OPERATOR);
      const { access_token } = await loginBody(admin.email);
      expect((await api.call('post', '/platform/api/v1/tenants', { token: access_token, body: {} })).status).toBe(422);

      const patched = await api.call('patch', `/platform/api/v1/users/${admin.id}`, {
        token: root,
        body: { role_id: roleIds[PLATFORM_SUPPORT] },
      });
      expect(patched.status).toBe(200);
      expect(patched.body.permissions_version).toBe(2);

      expect((await api.call('post', '/platform/api/v1/tenants', { token: access_token, body: {} })).status).toBe(403);
      expect((await api.call('get', '/platform/api/v1/tenants', { token: access_token })).status).toBe(200);
    });

    it('disabling logs out at once; the account cannot log in; reactivating needs a new login', async () => {
      const admin = await createAdmin(PLATFORM_SUPPORT);
      const session = await loginBody(admin.email);
      const off = await api.call('patch', `/platform/api/v1/users/${admin.id}/status`, { token: root, body: { status: 'DISABLED' } });
      expect(off.status).toBe(200);

      const me = await api.call('get', '/platform/api/v1/auth/me', { token: session.access_token });
      expect(me.status).toBe(401);
      expect(me.body.code).toBe('TOKEN_REVOKED');
      expect((await api.call('post', '/platform/api/v1/auth/refresh', { body: { refresh_token: session.refresh_token } })).status).toBe(
        401,
      );
      const refused = await api.call('post', '/platform/api/v1/auth/login', { body: { email: admin.email, password: PASSWORD } });
      expect(refused.status).toBe(401);
      expect(refused.body.code).toBe('INVALID_CREDENTIALS');

      expect(
        (await api.call('patch', `/platform/api/v1/users/${admin.id}/status`, { token: root, body: { status: 'ACTIVE' } })).status,
      ).toBe(200);
      expect((await api.call('get', '/platform/api/v1/auth/me', { token: session.access_token })).status).toBe(401);
      await expect(loginBody(admin.email)).resolves.toMatchObject({ access_token: expect.any(String) });
    });
  });

  describe('BE-F01-22 / E-PLAT-01: the platform keeps one active Super Admin', () => {
    const disableExtras = async (keep: string) => {
      for (const { id } of (await superAdmins()).rows) {
        if (id !== keep) await api.call('patch', `/platform/api/v1/users/${id}/status`, { token: root, body: { status: 'DISABLED' } });
      }
    };
    let rootId: string;

    beforeAll(async () => {
      rootId = (await api.call('get', '/platform/api/v1/auth/me', { token: root })).body.user.id;
    });

    it('the last one cannot disable itself or change its own role: 409 LAST_SUPER_ADMIN', async () => {
      await disableExtras(rootId);
      const off = await api.call('patch', `/platform/api/v1/users/${rootId}/status`, { token: root, body: { status: 'DISABLED' } });
      expect(off.status).toBe(409);
      expect(off.body.code).toBe('LAST_SUPER_ADMIN');
      const demote = await api.call('patch', `/platform/api/v1/users/${rootId}`, {
        token: root,
        body: { role_id: roleIds[PLATFORM_OPERATOR] },
      });
      expect(demote.status).toBe(409);
      expect(demote.body.code).toBe('LAST_SUPER_ADMIN');
      expect((await superAdmins()).rows).toHaveLength(1);
    });

    it('two Super Admins disabling each other at the same moment: one wins, one stays', async () => {
      const other = await createAdmin(PLATFORM_SUPER_ADMIN);
      const otherToken = (await loginBody(other.email)).access_token;
      const results = await Promise.all([
        api.call('patch', `/platform/api/v1/users/${other.id}/status`, { token: root, body: { status: 'DISABLED' } }),
        api.call('patch', `/platform/api/v1/users/${rootId}/status`, { token: otherToken, body: { status: 'DISABLED' } }),
      ]);
      const active = (await superAdmins()).rows;
      expect(active).toHaveLength(1);
      expect(results.map((r) => r.status).filter((s) => s === 200)).toHaveLength(1);
      // Whoever lost got 409 (LAST_SUPER_ADMIN) or 401 (its session ended first): never a second success
      expect(results.map((r) => r.status).every((s) => [200, 401, 409].includes(s))).toBe(true);

      // Leave the suite with the default Super Admin active and logged in
      if (active[0].id !== rootId) {
        const winner = active[0].id === other.id ? otherToken : root;
        await api.call('patch', `/platform/api/v1/users/${rootId}/status`, { token: winner, body: { status: 'ACTIVE' } });
        root = await api.platformToken();
      }
    });
  });

  describe('BE-F01-23: tokens of the two sides refuse each other', () => {
    it('a tenant token on a platform route and a platform token on a tenant route', async () => {
      const t = await api.createTenant(root, uniqueSubdomain('cross'));
      const tenantToken = await api.adminLogin(t.subdomain);
      expect((await api.call('get', '/platform/api/v1/tenants', { token: tenantToken })).status).toBe(401);
      expect((await api.call('get', '/api/v1/auth/me', { host: hostOf(t.subdomain), token: root })).status).toBe(401);
    });

    it('E-AUTH-05/07: forged, unsigned, wrong audience, malformed header: 401', async () => {
      const claims = { sub: '00000000-0000-4000-8000-000000000000', typ: 'platform', ver: 0, sid: '00000000-0000-4000-8000-000000000000' };
      const secret = process.env.PLATFORM_JWT_SECRET!;
      const forged = [
        sign(claims, 'x'.repeat(48), { issuer: 'compta-platform', audience: 'compta-platform-api' }),
        sign(claims, secret, { issuer: 'compta-tenant', audience: 'compta-platform-api' }),
        sign(claims, secret, { issuer: 'compta-platform', audience: 'compta-tenant-api' }),
        sign(claims, secret, { issuer: 'compta-platform', audience: 'compta-platform-api', expiresIn: -60 }),
        sign(claims, process.env.JWT_SECRET!, { issuer: 'compta-platform', audience: 'compta-platform-api' }),
        `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.`,
        // Valid signature, but no such session
        sign(claims, secret, { issuer: 'compta-platform', audience: 'compta-platform-api' }),
      ];
      for (const token of forged) expect((await api.call('get', '/platform/api/v1/auth/me', { token })).status).toBe(401);
      for (const header of ['Bearer', 'Basic abc', `Bearer ${root} ${root}`, `bearer ${root}`, `Bearer ${'a'.repeat(9000)}`]) {
        const res = await api.call('get', '/platform/api/v1/auth/me', { headers: { Authorization: header } });
        expect(res.status).toBe(401);
      }
    });
  });

  describe('BE-F01-24: sessions behave as on the tenant side', () => {
    let email: string;
    beforeEach(async () => {
      email = (await createAdmin(PLATFORM_SUPPORT)).email;
    });

    it('login returns tokens, user, context, roles, permissions; the refresh token is stored hashed', async () => {
      const body = await loginBody(email);
      expect(body).toMatchObject({
        token_type: 'Bearer',
        expires_in: 900,
        user: { email },
        context: { type: 'platform' },
        roles: [PLATFORM_SUPPORT],
        permissions_version: 1,
        modules: expect.any(Array),
      });
      const { rows } = await withControl((c) => c.query('SELECT token_hash FROM platform_refresh_tokens'));
      expect(rows.map((r) => r.token_hash)).not.toContain(body.refresh_token);
    });

    it('refresh rotates; using the old token again ends the session, with an audit row', async () => {
      const first = await loginBody(email);
      const rotated = await api.call('post', '/platform/api/v1/auth/refresh', { body: { refresh_token: first.refresh_token } });
      expect(rotated.status).toBe(200);
      expect(rotated.body.refresh_token).not.toBe(first.refresh_token);
      expect((await api.call('get', '/platform/api/v1/auth/me', { token: rotated.body.access_token })).status).toBe(200);

      await withControl((c) =>
        c.query(`UPDATE platform_refresh_tokens SET used_at = now() - interval '1 minute' WHERE used_at IS NOT NULL`),
      );
      const reused = await api.call('post', '/platform/api/v1/auth/refresh', { body: { refresh_token: first.refresh_token } });
      expect(reused.status).toBe(401);
      expect(
        (await api.call('post', '/platform/api/v1/auth/refresh', { body: { refresh_token: rotated.body.refresh_token } })).status,
      ).toBe(401);
      expect((await api.call('get', '/platform/api/v1/auth/me', { token: rotated.body.access_token })).status).toBe(401);
      expect((await auditRows('auth.refresh_reuse')).length).toBeGreaterThan(0);
    });

    it('logout kills access and refresh token; logging out twice, or with no token, still succeeds (E-SESS-06)', async () => {
      const session = await loginBody(email);
      const out = await api.call('post', '/platform/api/v1/auth/logout', {
        token: session.access_token,
        body: { refresh_token: session.refresh_token },
      });
      expect(out.status).toBe(204);
      expect((await api.call('get', '/platform/api/v1/auth/me', { token: session.access_token })).status).toBe(401);
      expect((await api.call('post', '/platform/api/v1/auth/refresh', { body: { refresh_token: session.refresh_token } })).status).toBe(
        401,
      );
      expect((await api.call('post', '/platform/api/v1/auth/logout', { token: session.access_token, body: {} })).status).toBe(204);
      expect((await api.call('post', '/platform/api/v1/auth/logout', { body: {} })).status).toBe(204);
    });

    it('changing the password ends the other sessions, keeps this one; wrong or reused password refused', async () => {
      const [mine, other] = [await loginBody(email), await loginBody(email)];
      const change = (body: object) => api.call('post', '/platform/api/v1/auth/password', { token: mine.access_token, body });

      expect((await change({ current_password: 'Wrong-Password-2026', new_password: 'New-Password-2026-x' })).status).toBe(422);
      const reused = await change({ current_password: PASSWORD, new_password: PASSWORD });
      expect(reused.status).toBe(422);
      expect(reused.body.code).toBe('PASSWORD_REUSED');
      expect((await change({ current_password: PASSWORD, new_password: 'short' })).status).toBe(422);

      expect((await change({ current_password: PASSWORD, new_password: 'New-Password-2026-x' })).status).toBe(204);
      expect((await api.call('get', '/platform/api/v1/auth/me', { token: mine.access_token })).status).toBe(200);
      expect((await api.call('get', '/platform/api/v1/auth/me', { token: other.access_token })).status).toBe(401);
      expect((await api.call('post', '/platform/api/v1/auth/refresh', { body: { refresh_token: other.refresh_token } })).status).toBe(401);
      await expect(loginBody(email, 'New-Password-2026-x')).resolves.toMatchObject({ access_token: expect.any(String) });
    });

    it('E-MFA-04 on the platform: guessing the current password behind a session counts toward the lock', async () => {
      const { access_token } = await loginBody(email);
      const guess = (current_password: string) =>
        api.call('post', '/platform/api/v1/auth/password', {
          token: access_token,
          body: { current_password, new_password: 'New-Password-2026-x' },
        });
      const results = await Promise.all(Array.from({ length: 5 }, (_, i) => guess(`Wrong-Guess-Password-${i}`)));
      expect(results.map((r) => r.status)).toEqual([422, 422, 422, 422, 422]);

      // Locked: the right password gets the same answer, and changes nothing
      const right = await guess(PASSWORD);
      expect(right.status).toBe(422);
      expect(right.body.fields[0].field).toBe('current_password');
      expect((await api.call('post', '/platform/api/v1/auth/login', { body: { email, password: PASSWORD } })).status).toBe(401);
      const failures = await auditRows('auth.password_check_failed');
      expect(failures.length).toBeGreaterThanOrEqual(5);
    });

    it('an expired session cannot refresh: idle 30 minutes and the 12-hour limit (AC-07)', async () => {
      const idle = await loginBody(email);
      await withControl((c) =>
        c.query(
          `UPDATE platform_sessions SET last_used_at = now() - interval '30 minutes' WHERE admin_id = (SELECT id FROM platform_admins WHERE email = $1)`,
          [email],
        ),
      );
      expect((await api.call('post', '/platform/api/v1/auth/refresh', { body: { refresh_token: idle.refresh_token } })).status).toBe(401);

      const old = await loginBody(email);
      await withControl((c) =>
        c.query(
          `UPDATE platform_sessions SET expires_at = now() - interval '1 second' WHERE admin_id = (SELECT id FROM platform_admins WHERE email = $1)`,
          [email],
        ),
      );
      expect((await api.call('post', '/platform/api/v1/auth/refresh', { body: { refresh_token: old.refresh_token } })).status).toBe(401);
    });
  });

  describe('BE-F01-25: platform_audit_logs', () => {
    it('records logins, failures and changes, with actor and client; never a secret', async () => {
      const admin = await createAdmin(PLATFORM_SUPPORT);
      const bad = await api.call('post', '/platform/api/v1/auth/login', {
        body: { email: admin.email, password: 'Wrong-Secret-Password-1' },
        headers: { 'User-Agent': 'e2e-agent' },
      });
      expect(bad.status).toBe(401);
      await loginBody(admin.email);

      const created = await auditRows('platform_user.create', admin.id);
      expect(created).toHaveLength(1);
      expect(created[0].actor_email).toBe('superadmin@platform.local');
      expect(created[0].after).toMatchObject({ email: admin.email });
      const failed = await withControl((c) =>
        c.query(`SELECT * FROM platform_audit_logs WHERE action = 'auth.login_failed' AND actor_email = $1`, [admin.email]),
      );
      expect(failed.rows[0]).toMatchObject({ actor_email: admin.email, user_agent: 'e2e-agent' });
      expect(failed.rows[0].ip).toBeTruthy();
      expect(
        (
          await withControl((c) =>
            c.query(`SELECT 1 FROM platform_audit_logs WHERE action = 'auth.login' AND actor_email = $1`, [admin.email]),
          )
        ).rows,
      ).toHaveLength(1);

      const all = await withControl((c) => c.query("SELECT coalesce(json_agg(l)::text, '') AS dump FROM platform_audit_logs l"));
      expect(all.rows[0].dump).not.toMatch(new RegExp(`${PASSWORD}|Wrong-Secret-Password|\\$argon2`));
    });

    it('cannot be changed or removed, even by the database owner', async () => {
      await withControl(async (c) => {
        await expect(c.query(`UPDATE platform_audit_logs SET action = 'x'`)).rejects.toThrow(/append-only/);
        await expect(c.query('DELETE FROM platform_audit_logs')).rejects.toThrow(/append-only/);
        await expect(c.query('TRUNCATE platform_audit_logs')).rejects.toThrow(/append-only/);
      });
    });

    it('filters and paginates; bigint ids come back as strings', async () => {
      const res = await api.call('get', '/platform/api/v1/audit-logs?action=platform_user.create&page_size=1', { token: root });
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        action: 'platform_user.create',
        id: expect.any(String),
        actor_email: 'superadmin@platform.local',
      });
      expect(res.body.total).toBeGreaterThan(1);
      expect((await api.call('get', '/platform/api/v1/audit-logs?from=not-a-date', { token: root })).status).toBe(422);
      const none = await api.call('get', '/platform/api/v1/audit-logs?actor_email=nobody@x.test', { token: root });
      expect(none.body).toMatchObject({ items: [], total: 0 });
    });
  });
});
