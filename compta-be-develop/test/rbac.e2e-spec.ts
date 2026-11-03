import { NestExpressApplication } from '@nestjs/platform-express';
import { EnforcerService } from '../src/modules/rbac/enforcer.service';
import { TenantRegistryService } from '../src/modules/tenancy/tenant-registry.service';
import { PRD_PERMISSION_MATRIX } from './fixtures/prd-permission-matrix';
import { Api, billingAddress, createTestApp, hostOf, uniqueSubdomain, USER_PASSWORD } from './support/app';
import { withTenantDb } from './support/db';

/** Casbin with the real Prisma adapter, through the HTTP guards (F04). */
describe('RBAC & users (F04)', () => {
  let app: NestExpressApplication;
  let api: Api;
  const sub = uniqueSubdomain('rbac');
  const host = hostOf(sub);
  let admin: string;
  let companyA: string;
  let companyB: string;
  const roles: Record<string, string> = {};

  const call = (method: Parameters<Api['call']>[0], path: string, opts: Parameters<Api['call']>[2] = {}) =>
    api.call(method, path, { host, ...opts });

  async function createUser(email: string, memberships: { company_id: string | null; role_id: string }[]) {
    const res = await call('post', '/api/v1/users', {
      token: admin,
      body: { email, full_name: email, password: USER_PASSWORD, memberships },
    });
    if (res.status !== 201) throw new Error(`createUser ${res.status} ${JSON.stringify(res.body)}`);
    return { id: res.body.id as string, token: await api.login(sub, email, USER_PASSWORD) };
  }

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    await api.createTenant(await api.platformToken(), sub, { plan: 'business' });
    admin = await api.adminLogin(sub);
    companyA = (await call('get', '/api/v1/companies', { token: admin })).body[0].id;
    companyB = (
      await call('post', '/api/v1/companies', { token: admin, body: { legal_name: 'DFM NEW YORK', country_code: 'US', currency: 'USD' } })
    ).body.id;
    for (const r of (await call('get', '/api/v1/roles', { token: admin })).body) roles[r.key] = r.id;
  });
  afterAll(() => app.close());

  it('seeds the 5 system roles of PRD §1.8, without wildcard grants', async () => {
    const res = await call('get', '/api/v1/roles', { token: admin });
    expect(res.body.map((r: { key: string }) => r.key).sort()).toEqual(['accountant', 'owner', 'sales', 'tenant_admin', 'viewer']);
    const grants = res.body.flatMap((r: { grants: { resource: string; action: string }[] }) => r.grants);
    expect(grants.some((g: { resource: string; action: string }) => g.resource === '*' || g.action === '*')).toBe(false);
    const viewer = res.body.find((r: { key: string }) => r.key === 'viewer');
    expect(viewer.grants.map((g: { resource: string }) => g.resource)).not.toContain('audit');
  });

  describe('data scope', () => {
    let sale1: { id: string; token: string };
    let sale2: { id: string; token: string };
    let owner: { id: string; token: string };
    let c2: string;

    beforeAll(async () => {
      sale1 = await createUser(`sale1@${sub}.test`, [{ company_id: companyA, role_id: roles.sales }]);
      sale2 = await createUser(`sale2@${sub}.test`, [{ company_id: companyA, role_id: roles.sales }]);
      owner = await createUser(`owner@${sub}.test`, [{ company_id: companyA, role_id: roles.owner }]);
      await call('post', '/api/v1/customers', {
        token: sale1.token,
        company: companyA,
        body: { type: 'COMPANY', name: 'S1 client', addresses: [billingAddress] },
      });
      c2 = (
        await call('post', '/api/v1/customers', {
          token: sale2.token,
          company: companyA,
          body: { type: 'COMPANY', name: 'S2 client', addresses: [billingAddress] },
        })
      ).body.id;
    });

    it('sales sees only own customers (AC-02/BR-03), owner sees the whole company', async () => {
      expect((await call('get', '/api/v1/customers', { token: sale1.token, company: companyA })).body.total).toBe(1);
      expect((await call('get', '/api/v1/customers', { token: owner.token, company: companyA })).body.total).toBe(2);
    });

    it("direct access to another sale's customer answers 403 OUT_OF_SCOPE (AC-03)", async () => {
      for (const [method, path] of [
        ['get', `/api/v1/customers/${c2}`],
        ['patch', `/api/v1/customers/${c2}`],
      ] as const) {
        const res = await call(method, path, {
          token: sale1.token,
          company: companyA,
          body: method === 'patch' ? { notes: 'x' } : undefined,
        });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('OUT_OF_SCOPE');
      }
    });

    it('sharing makes the customer visible; the share target must be an active member of the company (B5)', async () => {
      const outsider = await createUser(`ny@${sub}.test`, [{ company_id: companyB, role_id: roles.sales }]);
      const bad = await call('post', `/api/v1/customers/${c2}/shares`, {
        token: sale2.token,
        company: companyA,
        body: { user_id: outsider.id },
      });
      expect(bad.status).toBe(422);
      expect(bad.body.code).toBe('INVALID_ASSIGNEE');

      expect(
        (await call('post', `/api/v1/customers/${c2}/shares`, { token: sale2.token, company: companyA, body: { user_id: sale1.id } }))
          .status,
      ).toBe(204);
      expect((await call('get', '/api/v1/customers', { token: sale1.token, company: companyA })).body.total).toBe(2);
    });

    it('sales cannot reassign owner; owner can only assign to a member of the company', async () => {
      const own = await call('post', '/api/v1/customers', {
        token: sale1.token,
        company: companyA,
        body: { type: 'COMPANY', name: 'x', owner_id: sale2.id, addresses: [billingAddress] },
      });
      expect(own.status).toBe(403);
      const outsider = (await call('get', '/api/v1/users', { token: admin })).body.find(
        (u: { email: string }) => u.email === `ny@${sub}.test`,
      );
      const res = await call('patch', `/api/v1/customers/${c2}`, {
        token: owner.token,
        company: companyA,
        body: { owner_id: outsider.id },
      });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_ASSIGNEE');
    });

    it('a user holds different roles in different companies', async () => {
      const multi = await createUser(`multi@${sub}.test`, [
        { company_id: companyA, role_id: roles.viewer },
        { company_id: companyB, role_id: roles.sales },
      ]);
      expect((await call('get', '/api/v1/customers', { token: multi.token, company: companyA })).body.total).toBe(2);
      expect(
        (
          await call('post', '/api/v1/customers', {
            token: multi.token,
            company: companyA,
            body: { type: 'COMPANY', name: 'x', addresses: [billingAddress] },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await call('post', '/api/v1/customers', {
            token: multi.token,
            company: companyB,
            body: { type: 'COMPANY', name: 'NY', addresses: [billingAddress] },
          })
        ).status,
      ).toBe(201);
    });
  });

  describe('company header (B2)', () => {
    it('rejects malformed, unknown and inactive companies', async () => {
      const malformed = await call('get', '/api/v1/customers', { token: admin, company: 'abc' });
      expect(malformed.status).toBe(400);
      const unknown = await call('get', '/api/v1/customers', { token: admin, company: '00000000-0000-4000-8000-000000000000' });
      expect(unknown.status).toBe(404);
      expect(unknown.body.code).toBe('COMPANY_NOT_FOUND');

      const extra = (await call('post', '/api/v1/companies', { token: admin, body: { legal_name: 'TEMP', country_code: 'US' } })).body.id;
      expect((await call('patch', `/api/v1/companies/${extra}`, { token: admin, body: { status: 'INACTIVE' } })).status).toBe(200);
      const inactive = await call('get', '/api/v1/customers', { token: admin, company: extra });
      expect(inactive.status).toBe(403);
      expect(inactive.body.code).toBe('COMPANY_INACTIVE');
    });
  });

  describe('BE-F04-15 privilege escalation (B1)', () => {
    it('a role granting TENANT scope, assigned to one company, cannot act tenant-wide', async () => {
      const custom = await call('post', '/api/v1/roles', {
        token: admin,
        body: { key: 'pseudo_admin', name: 'Pseudo admin', grants: [{ resource: 'user', action: 'manage', scope: 'TENANT' }] },
      });
      expect(custom.status).toBe(201);
      const pseudo = await createUser(`pseudo@${sub}.test`, [{ company_id: companyA, role_id: custom.body.id }]);

      const res = await call('post', '/api/v1/users', {
        token: pseudo.token,
        company: companyA,
        body: {
          email: `evil@${sub}.test`,
          full_name: 'Evil',
          password: USER_PASSWORD,
          memberships: [{ company_id: null, role_id: roles.tenant_admin }],
        },
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TENANT_SCOPE_REQUIRED');
      expect((await call('get', '/api/v1/users', { token: pseudo.token })).status).toBe(403);
    });

    it('system roles cannot be modified (409 SYSTEM_ROLE_LOCKED)', async () => {
      const res = await call('patch', `/api/v1/roles/${roles.sales}`, { token: admin, body: { grants: [] } });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SYSTEM_ROLE_LOCKED');
    });

    it('custom role changes apply on the next request (policy reload)', async () => {
      const role = await call('post', '/api/v1/roles', {
        token: admin,
        body: { key: 'reader', name: 'Reader', grants: [{ resource: 'customer', action: 'read', scope: 'COMPANY' }] },
      });
      const reader = await createUser(`reader@${sub}.test`, [{ company_id: companyA, role_id: role.body.id }]);
      expect((await call('get', '/api/v1/customers', { token: reader.token, company: companyA })).status).toBe(200);
      expect((await call('patch', `/api/v1/roles/${role.body.id}`, { token: admin, body: { grants: [] } })).status).toBe(204);
      expect((await call('get', '/api/v1/customers', { token: reader.token, company: companyA })).status).toBe(403);
    });
  });

  describe('GET /auth/me permissions (display only)', () => {
    interface MeMembership {
      company: { id: string; legal_name: string; status: string } | null;
      role: { id: string; key: string; name: string };
      permissions: { resource: string; action: string; scope: string }[];
    }

    const me = async (token: string) => {
      const res = await call('get', '/api/v1/auth/me', { token });
      expect(res.status).toBe(200);
      return res.body as { id: string; memberships: MeMembership[] };
    };
    const scopes = (m: MeMembership) => Object.fromEntries(m.permissions.map((p) => [`${p.resource}.${p.action}`, p.scope]));

    /** What Casbin really enforces for this user, with the real policy tables. */
    const casbinScope = async (userId: string, companyId: string | null, resource: string, action: string) => {
      const registry = app.get(TenantRegistryService);
      const tenant = (await registry.findBySubdomain(sub))!;
      const enforcers = app.get(EnforcerService);
      return enforcers.resolveScope(await enforcers.forTenant(tenant.id, registry.clientFor(tenant)), userId, companyId, resource, action);
    };

    it.each(['owner', 'accountant', 'sales', 'viewer'] as const)(
      'BE-F04-15 the %s role has exactly the grants of the PRD matrix',
      async (key) => {
        const user = await createUser(`matrix-${key}@${sub}.test`, [{ company_id: companyA, role_id: roles[key] }]);
        const { memberships } = await me(user.token);
        expect(scopes(memberships[0])).toEqual(PRD_PERMISSION_MATRIX[key]);
      },
    );

    it('BE-F04-15 admin: tenant-wide membership (company null) with TENANT scope', async () => {
      const { memberships } = await me(admin);
      expect(memberships).toHaveLength(1);
      expect(memberships[0].company).toBeNull();
      expect(memberships[0].role).toEqual({ id: roles.tenant_admin, key: 'tenant_admin', name: expect.any(String) });
      expect(scopes(memberships[0])).toEqual(PRD_PERMISSION_MATRIX.tenant_admin);
    });

    it('sales: company membership with OWN scope, company described', async () => {
      const sales = await createUser(`me-sales@${sub}.test`, [{ company_id: companyA, role_id: roles.sales }]);
      const { memberships } = await me(sales.token);
      expect(memberships).toHaveLength(1);
      expect(memberships[0].company).toEqual({ id: companyA, legal_name: expect.any(String), status: 'ACTIVE' });
      expect(scopes(memberships[0])).toEqual(PRD_PERMISSION_MATRIX.sales);
      expect(scopes(memberships[0])['customer.read']).toBe('OWN');
    });

    it('a TENANT grant is shown as COMPANY on a company membership, and as TENANT tenant-wide, matching Casbin', async () => {
      const grants = [
        { resource: 'user', action: 'manage', scope: 'TENANT' },
        { resource: 'customer', action: 'read', scope: 'TENANT' },
        { resource: 'quote', action: 'read', scope: 'OWN' },
      ];
      const role = (await call('post', '/api/v1/roles', { token: admin, body: { key: 'me_custom', name: 'Me custom', grants } })).body.id;

      const bound = await createUser(`me-bound@${sub}.test`, [{ company_id: companyA, role_id: role }]);
      const boundMe = (await me(bound.token)).memberships[0];
      expect(scopes(boundMe)).toEqual({ 'user.manage': 'COMPANY', 'customer.read': 'COMPANY', 'quote.read': 'OWN' });

      const wide = await createUser(`me-wide@${sub}.test`, [{ company_id: null, role_id: role }]);
      const wideMe = (await me(wide.token)).memberships[0];
      expect(scopes(wideMe)).toEqual({ 'user.manage': 'TENANT', 'customer.read': 'TENANT', 'quote.read': 'OWN' });

      for (const { resource, action } of grants) {
        expect(await casbinScope(bound.id, companyA, resource, action)).toBe(scopes(boundMe)[`${resource}.${action}`]);
        expect(await casbinScope(wide.id, null, resource, action)).toBe(scopes(wideMe)[`${resource}.${action}`]);
      }
    });

    it('a user in several companies gets one entry per company, each with its own role and permissions', async () => {
      const multi = await createUser(`me-multi@${sub}.test`, [
        { company_id: companyA, role_id: roles.viewer },
        { company_id: companyB, role_id: roles.sales },
      ]);
      const { memberships } = await me(multi.token);
      expect(memberships.map((m) => m.role.key).sort()).toEqual(['sales', 'viewer']);
      const inA = memberships.find((m) => m.company?.id === companyA)!;
      const inB = memberships.find((m) => m.company?.id === companyB)!;
      expect(scopes(inA)).toEqual(PRD_PERMISSION_MATRIX.viewer);
      expect(scopes(inB)).toEqual(PRD_PERMISSION_MATRIX.sales);
      expect(await casbinScope(multi.id, companyA, 'customer', 'read')).toBe('COMPANY');
      expect(await casbinScope(multi.id, companyB, 'customer', 'read')).toBe('OWN');
    });

    it('reflects role changes on the next call', async () => {
      const role = await call('post', '/api/v1/roles', {
        token: admin,
        body: { key: 'me_changing', name: 'Changing', grants: [{ resource: 'customer', action: 'read', scope: 'COMPANY' }] },
      });
      const user = await createUser(`me-change@${sub}.test`, [{ company_id: companyA, role_id: role.body.id }]);
      expect(scopes((await me(user.token)).memberships[0])).toEqual({ 'customer.read': 'COMPANY' });
      await call('patch', `/api/v1/roles/${role.body.id}`, {
        token: admin,
        body: { grants: [{ resource: 'quote', action: 'read', scope: 'OWN' }] },
      });
      expect(scopes((await me(user.token)).memberships[0])).toEqual({ 'quote.read': 'OWN' });
    });

    it('returns only the profile and permissions of the caller, in snake_case, and needs no permission', async () => {
      const viewer = await createUser(`me-viewer@${sub}.test`, [{ company_id: companyA, role_id: roles.viewer }]);
      const res = await call('get', '/api/v1/auth/me', { token: viewer.token });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual([
        'email',
        'email_signature',
        'full_name',
        'id',
        'last_company_id',
        'locale',
        'memberships',
        'mfa_enabled',
        'permissions_version',
        'phone',
        'status',
      ]);
      expect(res.body.id).toBe(viewer.id);
      expect(res.body.memberships).toHaveLength(1);

      const body = await me(admin);
      expect(Object.keys(body.memberships[0]).sort()).toEqual(['company', 'permissions', 'role']);
      expect(Object.keys(body.memberships[0].permissions[0]).sort()).toEqual(['action', 'resource', 'scope']);
      expect(JSON.stringify(body)).not.toMatch(/password|mfa_secret|token_version|failed_login/);
    });
  });

  describe('disabling users (AC-04, B7)', () => {
    it('revokes every token immediately, including on @AuthOnly routes; re-enabling needs a new login', async () => {
      const user = await createUser(`gone@${sub}.test`, [{ company_id: companyA, role_id: roles.viewer }]);
      expect((await call('get', '/api/v1/auth/me', { token: user.token })).status).toBe(200);

      expect((await call('patch', `/api/v1/users/${user.id}/status`, { token: admin, body: { status: 'DISABLED' } })).status).toBe(200);
      for (const path of ['/api/v1/auth/me', '/api/v1/companies']) {
        const res = await call('get', path, { token: user.token });
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('TOKEN_REVOKED');
      }
      const login = await call('post', '/api/v1/auth/login', { body: { email: `gone@${sub}.test`, password: USER_PASSWORD } });
      expect(login.status).toBe(401);

      await call('patch', `/api/v1/users/${user.id}/status`, { token: admin, body: { status: 'ACTIVE' } });
      expect((await call('get', '/api/v1/auth/me', { token: user.token })).status).toBe(401);
      const fresh = await api.login(sub, `gone@${sub}.test`, USER_PASSWORD);
      expect((await call('get', '/api/v1/auth/me', { token: fresh })).status).toBe(200);
    });
  });

  describe('last admin (BR-01)', () => {
    it('refuses to disable or demote the last active tenant admin with 409 LAST_ADMIN', async () => {
      // The default admin@<subdomain>.local is a second tenant admin: disabling it is allowed
      const users = (await call('get', '/api/v1/users', { token: admin })).body as { id: string; email: string }[];
      const defaultAdmin = users.find((u) => u.email === `admin@${sub}.local`)!;
      expect((await call('patch', `/api/v1/users/${defaultAdmin.id}/status`, { token: admin, body: { status: 'DISABLED' } })).status).toBe(
        200,
      );

      const me = (await call('get', '/api/v1/auth/me', { token: admin })).body;
      const disable = await call('patch', `/api/v1/users/${me.id}/status`, { token: admin, body: { status: 'DISABLED' } });
      expect(disable.status).toBe(409);
      expect(disable.body.code).toBe('LAST_ADMIN');

      const demote = await call('put', `/api/v1/users/${me.id}/memberships`, {
        token: admin,
        body: { memberships: [{ company_id: companyA, role_id: roles.tenant_admin }] },
      });
      expect(demote.status).toBe(409);
      expect(demote.body.code).toBe('LAST_ADMIN');
      // Nothing changed
      expect((await call('get', '/api/v1/auth/me', { token: admin })).status).toBe(200);
    });

    it('allows it once another admin exists', async () => {
      const second = await createUser(`admin2@${sub}.test`, [{ company_id: null, role_id: roles.tenant_admin }]);
      const res = await call('patch', `/api/v1/users/${second.id}/status`, { token: admin, body: { status: 'DISABLED' } });
      expect(res.status).toBe(200);
    });
  });

  describe('memberships validation', () => {
    it('rejects unknown roles/companies and duplicate companies with 422', async () => {
      const res = await call('post', '/api/v1/users', {
        token: admin,
        body: {
          email: `bad@${sub}.test`,
          full_name: 'Bad',
          password: USER_PASSWORD,
          memberships: [
            { company_id: companyA, role_id: '00000000-0000-4000-8000-000000000000' },
            { company_id: companyA, role_id: roles.viewer },
            { company_id: '00000000-0000-4000-8000-000000000001', role_id: roles.viewer },
          ],
        },
      });
      expect(res.status).toBe(422);
      expect(res.body.fields.map((f: { field: string }) => f.field).sort()).toEqual([
        'memberships.0.role_id',
        'memberships.1.company_id',
        'memberships.2.company_id',
      ]);
    });
  });

  describe('lockout (F02 AC-03)', () => {
    it('locks a tenant user after 5 failures: generic 401', async () => {
      await createUser(`lock@${sub}.test`, [{ company_id: companyA, role_id: roles.viewer }]);
      for (let i = 0; i < 5; i++) {
        expect(
          (await call('post', '/api/v1/auth/login', { body: { email: `lock@${sub}.test`, password: 'Wrong-Password-1' } })).status,
        ).toBe(401);
      }
      const res = await call('post', '/api/v1/auth/login', { body: { email: `lock@${sub}.test`, password: USER_PASSWORD } });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });
});

describe('Plan limits (F01 BR-04)', () => {
  let app: NestExpressApplication;
  let api: Api;
  const sub = uniqueSubdomain('plan');

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
    await api.createTenant(await api.platformToken(), sub, { plan: 'starter' });
  });
  afterAll(() => app.close());

  it('starter plan: 1 company, 10 users (default accounts included) -> 402 PLAN_LIMIT_REACHED', async () => {
    const host = hostOf(sub);
    const admin = await api.adminLogin(sub);
    const company = await api.call('post', '/api/v1/companies', { host, token: admin, body: { legal_name: 'SECOND', country_code: 'US' } });
    expect(company.status).toBe(402);
    expect(company.body.code).toBe('PLAN_LIMIT_REACHED');

    const roleId = await withTenantDb(sub, async (db) => (await db.query(`SELECT id FROM roles WHERE key = 'viewer'`)).rows[0].id);
    // Users #1-6: the requested admin + the 5 default accounts, all ACTIVE and counted
    for (let i = 7; i <= 10; i++) {
      const res = await api.call('post', '/api/v1/users', {
        host,
        token: admin,
        body: {
          email: `u${i}@${sub}.test`,
          full_name: `U${i}`,
          password: USER_PASSWORD,
          memberships: [{ company_id: null, role_id: roleId }],
        },
      });
      expect(res.status).toBe(201);
    }
    const eleventh = await api.call('post', '/api/v1/users', {
      host,
      token: admin,
      body: { email: `u11@${sub}.test`, full_name: 'U11', password: USER_PASSWORD, memberships: [{ company_id: null, role_id: roleId }] },
    });
    expect(eleventh.status).toBe(402);
    expect(eleventh.body.code).toBe('PLAN_LIMIT_REACHED');
  });
});
