import './support/mfa-enforced';
import { DEFAULT_PASSWORD } from '../src/modules/platform/tenants/default-accounts';
import { ADMIN_PASSWORD, Api, createTestApp, uniqueSubdomain } from './support/app';
import { ensureLargePlan, LARGE_PLAN, TenantFixture, totp } from './support/tenant-fixture';

/** MFA_ENFORCED=true, the production default. */
describe('F02 BR-03 mandatory 2FA', () => {
  const fx = new TenantFixture(uniqueSubdomain('mfa'));
  let call: TenantFixture['call'];

  beforeAll(async () => {
    fx.app = await createTestApp();
    fx.api = new Api(fx.app);
    fx.platform = await fx.api.platformToken();
    await ensureLargePlan();
    await fx.api.createTenant(fx.platform, fx.sub, { plan: LARGE_PLAN });
    call = fx.call.bind(fx);

    // The first admin must pass the setup before anything else works
    const first = await fx.login(`admin@${fx.sub}.test`, ADMIN_PASSWORD);
    expect(first.body.mfa_setup_required).toBe(true);
    await fx.enableMfa(first.body.access_token);
    fx.admin = first.body.access_token;
    expect((await fx.login(`admin@${fx.sub}.test`, ADMIN_PASSWORD)).body.mfa_required).toBe(true);
    fx.companyA = (await call('get', '/api/v1/companies', { token: fx.admin })).body[0].id;
    for (const r of (await call('get', '/api/v1/roles', { token: fx.admin })).body) fx.roles[r.key] = r.id;
  });
  afterAll(() => fx.stop());

  it.each(['accountant', 'owner', 'tenant_admin'])('BE-F02-35 %s without 2FA: only the setup steps work until it is on', async (role) => {
    const u = await fx.user(role, role === 'tenant_admin' ? null : fx.companyA);
    const s = await fx.session(u.email);
    expect(s.body.mfa_setup_required).toBe(true);

    const blocked = await call('get', '/api/v1/customers', { token: s.access, company: fx.companyA });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('MFA_SETUP_REQUIRED');
    expect((await call('get', '/api/v1/auth/me', { token: s.access })).status).toBe(200);

    await fx.enableMfa(s.access);
    expect((await call('get', '/api/v1/companies', { token: s.access })).status).toBe(200);
  });

  it.each(['sales', 'viewer'])('BE-F02-36 %s without 2FA works normally', async (role) => {
    const u = await fx.user(role);
    const s = await fx.session(u.email);
    expect(s.body.mfa_setup_required).toBe(false);
    expect((await call('get', '/api/v1/companies', { token: s.access })).status).toBe(200);
  });

  it('BE-F02-37 the tenant can require 2FA for everyone: a sale is forced to set it up at the next request', async () => {
    const u = await fx.user('sales');
    const s = await fx.session(u.email);
    expect((await call('get', '/api/v1/companies', { token: s.access })).status).toBe(200);

    const set = await call('patch', '/api/v1/tenant/settings', { token: fx.admin, body: { mfa_required: true } });
    expect(set.status).toBe(200);
    expect(set.body.mfa_required).toBe(true);
    await new Promise((r) => setTimeout(r, 300));
    const blocked = await call('get', '/api/v1/companies', { token: s.access });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('MFA_SETUP_REQUIRED');

    await call('patch', '/api/v1/tenant/settings', { token: fx.admin, body: { mfa_required: false } });
    await new Promise((r) => setTimeout(r, 300));
    expect((await call('get', '/api/v1/companies', { token: s.access })).status).toBe(200);
  });

  it('the default 123456 account still logs in under MFA_ENFORCED=true and is then forced through the setup', async () => {
    const res = await fx.login(`admin@${fx.sub}.local`, DEFAULT_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.mfa_setup_required).toBe(true);
    expect((await call('get', '/api/v1/companies', { token: res.body.access_token })).status).toBe(403);
  });

  it('E-MFA-07 2FA cannot be turned off while the role requires it', async () => {
    const u = await fx.user('accountant');
    const s = await fx.session(u.email);
    const { secret } = await fx.enableMfa(s.access);
    const res = await call('post', '/api/v1/me/mfa/disable', { token: s.access, body: { password: u.password, code: totp(secret, 1) } });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MFA_REQUIRED');
  });

  it('E-MFA-08 moved to a role that requires 2FA: forced through the setup at the next request', async () => {
    const u = await fx.user('sales');
    const s = await fx.session(u.email);
    expect((await call('get', '/api/v1/companies', { token: s.access })).status).toBe(200);
    const res = await call('put', `/api/v1/users/${u.id}/memberships`, {
      token: fx.admin,
      body: { memberships: [{ company_id: fx.companyA, role_id: fx.roles.accountant }] },
    });
    expect(res.status).toBe(200);
    const blocked = await call('get', '/api/v1/companies', { token: s.access });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('MFA_SETUP_REQUIRED');
  });
});
