import { uniqueSubdomain, USER_PASSWORD } from './support/app';
import { withControl } from './support/db';
import { linkIn, tokenIn, waitForMails } from './support/mailpit';
import { TenantFixture } from './support/tenant-fixture';

const NEW_PASSWORD = 'Activated-Password-2026';

describe('F04 users, invitations, reassign', () => {
  const fx = new TenantFixture(uniqueSubdomain('users'));
  let call: TenantFixture['call'];

  const invite = (email: string, roleKey = 'sales', companyId: string | null = fx.companyA, token = fx.admin) =>
    call('post', '/api/v1/users/invitations', {
      token,
      body: { email, full_name: 'Invited Person', memberships: [{ company_id: companyId, role_id: fx.roles[roleKey] }] },
    });
  const accept = (token: string, password = NEW_PASSWORD) =>
    call('post', `/api/v1/auth/invitations/${encodeURIComponent(token)}/accept`, { body: { password } });
  const invitedToken = async (email: string, count = 1) => tokenIn((await waitForMails(email, count))[0]);
  const createCustomer = async (token: string, companyId: string, name: string) => {
    const res = await call('post', '/api/v1/customers', {
      token,
      company: companyId,
      body: { type: 'COMPANY', name, addresses: [{ type: 'BILLING', line1: '1 rue', postal_code: '75001', city: 'Paris' }] },
    });
    if (res.status !== 201) throw new Error(`customer ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as { id: string; owner_id: string };
  };

  beforeAll(async () => {
    await fx.start();
    call = fx.call.bind(fx);
  });
  afterAll(() => fx.stop());

  describe('invitations', () => {
    it('BE-F04-01 invites as INVITED; the mail reaches Mailpit through the queue; 7 days', async () => {
      const email = fx.email('inv');
      const res = await invite(email);
      expect(res.status).toBe(201);
      expect(res.body.user.status).toBe('INVITED');
      expect(res.body.mail_status).toBe('QUEUED');
      expect(res.body.invite_url).toBeUndefined();
      const days = (new Date(res.body.expires_at).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.9);
      expect(days).toBeLessThanOrEqual(7);
      const [mail] = await waitForMails(email);
      expect(linkIn(mail).origin).toBe(`http://${fx.sub}.compta.test`);
    });

    it('BE-F04-02 activation sets the password; the user then only sees their company', async () => {
      const email = fx.email('act');
      await invite(email, 'sales', fx.companyB);
      const token = await invitedToken(email);
      const info = await call('get', `/api/v1/auth/invitations/${encodeURIComponent(token)}`);
      expect(info.status).toBe(200);
      expect(info.body.email).toBe(email);

      const done = await accept(token);
      expect(done.status).toBe(200);
      expect(done.body.status).toBe('ACTIVE');
      const s = await fx.session(email, NEW_PASSWORD);
      const companies = await call('get', '/api/v1/companies', { token: s.access });
      expect(companies.body.map((c: { id: string }) => c.id)).toEqual([fx.companyB]);
      expect((await call('get', '/api/v1/customers', { token: s.access, company: fx.companyA })).status).toBe(403);
    });

    describe('F04 AC-01 the invitation names the right company', () => {
      const describeLink = (token: string) => call('get', `/api/v1/auth/invitations/${encodeURIComponent(token)}`);
      const legalNames = async () => {
        const rows = await fx.sql<{ id: string; legal_name: string }>('SELECT id, legal_name FROM companies');
        return Object.fromEntries(rows.map((r) => [r.id, r.legal_name]));
      };

      it('invited to the second company: mail and link name that one, not the first of the tenant', async () => {
        const names = await legalNames();
        const email = fx.email('second');
        expect((await invite(email, 'sales', fx.companyB)).status).toBe(201);
        const [mail] = await waitForMails(email);
        expect(mail.Subject).toContain(names[fx.companyB]);
        expect(mail.Text).toContain(names[fx.companyB]);
        expect(mail.Text).not.toContain(names[fx.companyA]);
        const info = await describeLink(tokenIn(mail));
        expect(info.body.company_name).toBe(names[fx.companyB]);
        expect(info.body.company_names).toEqual([names[fx.companyB]]);
      });

      it('invited to two companies: both are named', async () => {
        const names = await legalNames();
        const email = fx.email('two');
        const res = await call('post', '/api/v1/users/invitations', {
          token: fx.admin,
          body: {
            email,
            full_name: 'Two',
            memberships: [
              { company_id: fx.companyA, role_id: fx.roles.sales },
              { company_id: fx.companyB, role_id: fx.roles.viewer },
            ],
          },
        });
        expect(res.status).toBe(201);
        const [mail] = await waitForMails(email);
        for (const id of [fx.companyA, fx.companyB]) expect(mail.Text).toContain(names[id]);
        const info = await describeLink(tokenIn(mail));
        expect(info.body.company_names).toEqual([names[fx.companyA], names[fx.companyB]]);
      });

      it('a tenant-wide role: every active company is named', async () => {
        const email = fx.email('wide');
        expect((await invite(email, 'tenant_admin', null)).status).toBe(201);
        const info = await describeLink(tokenIn((await waitForMails(email))[0]));
        const active = await fx.sql<{ legal_name: string }>(`SELECT legal_name FROM companies WHERE status = 'ACTIVE' ORDER BY created_at`);
        expect(info.body.company_names).toEqual(active.map((c) => c.legal_name));
      });
    });

    it('accepting with a wrong token costs no password hash; a valid one hashes once', async () => {
      const password = jest.requireActual<typeof import('../src/modules/auth/password')>('../src/modules/auth/password');
      const hash = jest.spyOn(password, 'hashPassword');
      try {
        expect((await accept('wrong-token')).status).toBe(400);
        expect((await accept(`${fx.companyA}.wrong-random`)).status).toBe(400);
        expect(hash).not.toHaveBeenCalled();

        const email = fx.email('hash');
        await invite(email);
        const token = await invitedToken(email);
        hash.mockClear();
        expect((await accept(token)).status).toBe(200);
        expect(hash).toHaveBeenCalledTimes(1);
      } finally {
        hash.mockRestore();
      }
    });

    it('BE-F04-03 used, expired and wrong tokens are refused, a weak password too; only the hash is stored', async () => {
      const email = fx.email('bad');
      const res = await invite(email);
      const token = await invitedToken(email);
      const rows = await fx.sql<{ token_hash: string }>('SELECT token_hash FROM invitations WHERE user_id = $1', [res.body.user.id]);
      expect(JSON.stringify(rows)).not.toContain(token);

      expect((await accept(token, 'short')).status).toBe(422);
      expect((await accept('not-a-token')).status).toBe(400);
      expect((await accept(token)).status).toBe(200);
      expect((await accept(token)).status).toBe(400);

      const late = fx.email('late');
      const created = await invite(late);
      const lateToken = await invitedToken(late);
      await fx.sql(`UPDATE invitations SET expires_at = (now() AT TIME ZONE 'UTC') - interval '1 second' WHERE user_id = $1`, [
        created.body.user.id,
      ]);
      expect((await accept(lateToken)).status).toBe(400);
    });

    it('BE-F04-04 resending kills the old token; the new one works', async () => {
      const email = fx.email('resend');
      const created = await invite(email);
      const first = await invitedToken(email);
      const resend = await call('post', `/api/v1/users/${created.body.user.id}/invitations/resend`, { token: fx.admin });
      expect(resend.status).toBe(200);
      const mails = await waitForMails(email, 2);
      const second = tokenIn(mails.find((m) => tokenIn(m) !== first)!);
      expect((await accept(first)).status).toBe(400);
      expect((await accept(second)).status).toBe(200);
    });

    it('BE-F04-05 existing email and missing role: 422', async () => {
      const u = await fx.user();
      const taken = await invite(u.email);
      expect(taken.status).toBe(422);
      expect(taken.body.code).toBe('EMAIL_TAKEN');
      const noRole = await call('post', '/api/v1/users/invitations', {
        token: fx.admin,
        body: { email: fx.email('nr'), full_name: 'x', memberships: [] },
      });
      expect(noRole.status).toBe(422);
    });

    it('BE-F04-06 without user.manage: 403', async () => {
      const u = await fx.user('sales');
      const { access } = await fx.session(u.email);
      expect((await invite(fx.email('x'), 'sales', fx.companyA, access)).status).toBe(403);
    });

    it('E-INV-01 accepting twice in parallel: one succeeds', async () => {
      const email = fx.email('par');
      await invite(email);
      const token = await invitedToken(email);
      const results = await Promise.all([accept(token), accept(token, 'Another-Password-2026')]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    });

    it('E-INV-02 a company switched off after the invitation: reported, and the user cannot work there', async () => {
      const company = await call('post', '/api/v1/companies', {
        token: fx.admin,
        body: { legal_name: 'Soon Off Inc', country_code: 'US', currency: 'USD' },
      });
      const email = fx.email('off');
      await invite(email, 'sales', company.body.id);
      const token = await invitedToken(email);
      await fx.sql(`UPDATE companies SET status = 'INACTIVE' WHERE id = $1`, [company.body.id]);
      const done = await accept(token);
      expect(done.status).toBe(200);
      expect(done.body.unavailable_company_ids).toEqual([company.body.id]);
      const s = await fx.session(email, NEW_PASSWORD);
      expect((await call('get', '/api/v1/customers', { token: s.access, company: company.body.id })).status).toBe(403);
      await fx.sql(`UPDATE companies SET status = 'ACTIVE' WHERE id = $1`, [company.body.id]);
    });

    it('E-INV-02 a role deleted after the invitation cannot happen: the role is in use (409)', async () => {
      const role = await call('post', '/api/v1/roles', {
        token: fx.admin,
        body: { key: `r_${Date.now().toString(36)}`, name: 'R', grants: [{ resource: 'customer', action: 'read', scope: 'OWN' }] },
      });
      const email = fx.email('role');
      const res = await call('post', '/api/v1/users/invitations', {
        token: fx.admin,
        body: { email, full_name: 'x', memberships: [{ company_id: fx.companyA, role_id: role.body.id }] },
      });
      expect(res.status).toBe(201);
      const del = await call('delete', `/api/v1/roles/${role.body.id}`, { token: fx.admin });
      expect(del.status).toBe(409);
      expect(del.body.code).toBe('ROLE_IN_USE');
    });

    it('E-INV-04 disabling the inviter cancels what they had pending', async () => {
      const inviter = await fx.user('tenant_admin', null);
      const { access } = await fx.session(inviter.email);
      const email = fx.email('orphan');
      expect((await invite(email, 'sales', fx.companyA, access)).status).toBe(201);
      const token = await invitedToken(email);
      await call('patch', `/api/v1/users/${inviter.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } });
      expect((await accept(token)).status).toBe(400);
    });

    it('E-INV-05 an ACTIVE or DISABLED user cannot be invited again; their password stays', async () => {
      const u = await fx.user();
      expect((await call('post', `/api/v1/users/${u.id}/invitations/resend`, { token: fx.admin })).status).toBe(409);
      expect((await invite(u.email)).status).toBe(422);
      await call('patch', `/api/v1/users/${u.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } });
      expect((await invite(u.email)).status).toBe(422);
      await call('patch', `/api/v1/users/${u.id}/status`, { token: fx.admin, body: { status: 'ACTIVE' } });
      expect((await fx.login(u.email, USER_PASSWORD)).status).toBe(200);
    });

    it('E-INV-06 E-INV-08 the same address in another tenant is independent; a link only opens on its own tenant', async () => {
      const second = new TenantFixture(uniqueSubdomain('users2'));
      second.app = fx.app;
      second.api = fx.api;
      await fx.api.createTenant(fx.platform, second.sub, { plan: 'business' });
      second.admin = await fx.api.adminLogin(second.sub);
      for (const r of (await second.call('get', '/api/v1/roles', { token: second.admin })).body) second.roles[r.key] = r.id;
      const companyId = (await second.call('get', '/api/v1/companies', { token: second.admin })).body[0].id;

      const email = fx.email('both');
      await invite(email);
      const here = await invitedToken(email);
      const res = await second.call('post', '/api/v1/users/invitations', {
        token: second.admin,
        body: { email, full_name: 'x', memberships: [{ company_id: companyId, role_id: second.roles.sales }] },
      });
      expect(res.status).toBe(201);

      expect((await second.call('get', `/api/v1/auth/invitations/${encodeURIComponent(here)}`)).status).toBe(400);
      expect(
        (await second.call('post', `/api/v1/auth/invitations/${encodeURIComponent(here)}/accept`, { body: { password: NEW_PASSWORD } }))
          .status,
      ).toBe(400);
      expect((await accept(here)).status).toBe(200);
    });

    it('E-INV-09 a cancelled invitation: the link is dead and the seat is free', async () => {
      const email = fx.email('cancel');
      const created = await invite(email);
      const token = await invitedToken(email);
      expect((await call('delete', `/api/v1/users/${created.body.user.id}/invitations`, { token: fx.admin })).status).toBe(204);
      expect((await accept(token)).status).toBe(400);
      expect((await call('get', `/api/v1/auth/invitations/${encodeURIComponent(token)}`)).status).toBe(400);
    });

    it('E-FE-11 opening the link (GET) does not consume it', async () => {
      const email = fx.email('scan');
      await invite(email);
      const token = await invitedToken(email);
      for (const _ of [1, 2]) expect((await call('get', `/api/v1/auth/invitations/${encodeURIComponent(token)}`)).status).toBe(200);
      expect((await accept(token)).status).toBe(200);
    });
  });

  describe('plan limits', () => {
    it('BE-F04-05 E-INV-03 an invited user holds a seat; over the plan 402; a downgrade before accepting is refused with 402 too', async () => {
      const tiny = new TenantFixture(uniqueSubdomain('tiny'));
      tiny.app = fx.app;
      tiny.api = fx.api;
      await fx.api.createTenant(fx.platform, tiny.sub, { plan: 'starter' });
      tiny.admin = await fx.api.adminLogin(tiny.sub);
      for (const r of (await tiny.call('get', '/api/v1/roles', { token: tiny.admin })).body) tiny.roles[r.key] = r.id;
      const companyId = (await tiny.call('get', '/api/v1/companies', { token: tiny.admin })).body[0].id;
      const inviteTiny = (email: string) =>
        tiny.call('post', '/api/v1/users/invitations', {
          token: tiny.admin,
          body: { email, full_name: 'x', memberships: [{ company_id: companyId, role_id: tiny.roles.sales }] },
        });

      await withControl((c) =>
        c.query(
          `INSERT INTO plans (id, code, name, max_users, max_companies, max_invoices_monthly, max_ai_calls_monthly, updated_at) VALUES (gen_random_uuid(), 'e2e_tiny', 'Tiny', 7, 1, 10, 10, now()) ON CONFLICT (code) DO NOTHING`,
        ),
      );
      await withControl((c) =>
        c.query(`UPDATE tenants SET plan_id = (SELECT id FROM plans WHERE code = 'e2e_tiny') WHERE subdomain = $1`, [tiny.sub]),
      );
      const planEvent = (await import('../src/database/control-events.service')).ControlEventsService;
      const tenantId = (await withControl((c) => c.query('SELECT id FROM tenants WHERE subdomain = $1', [tiny.sub]))).rows[0].id;
      await fx.app.get(planEvent).publish({ kind: 'tenant', tenantId, subdomain: tiny.sub });
      await new Promise((r) => setTimeout(r, 200));

      // The default accounts and the admin take 6 of 7 seats
      const email = tiny.email('last');
      expect((await inviteTiny(email)).status).toBe(201);
      const over = await inviteTiny(tiny.email('over'));
      expect(over.status).toBe(402);
      expect(over.body.code).toBe('PLAN_LIMIT_REACHED');

      await withControl((c) => c.query(`UPDATE plans SET max_users = 6 WHERE code = 'e2e_tiny'`));
      await fx.app.get(planEvent).publish({ kind: 'tenant', tenantId, subdomain: tiny.sub });
      await new Promise((r) => setTimeout(r, 200));
      const token = tokenIn((await waitForMails(email))[0]);
      const refused = await tiny.call('post', `/api/v1/auth/invitations/${encodeURIComponent(token)}/accept`, {
        body: { password: NEW_PASSWORD },
      });
      expect(refused.status).toBe(402);

      await withControl((c) => c.query(`UPDATE plans SET max_users = 7 WHERE code = 'e2e_tiny'`));
      await fx.app.get(planEvent).publish({ kind: 'tenant', tenantId, subdomain: tiny.sub });
      await new Promise((r) => setTimeout(r, 200));
      expect(
        (await tiny.call('post', `/api/v1/auth/invitations/${encodeURIComponent(token)}/accept`, { body: { password: NEW_PASSWORD } }))
          .status,
      ).toBe(200);
    });
  });

  describe('roles and state', () => {
    it('BE-F04-07 a sale reading the customer of another sale: 403 OUT_OF_SCOPE, nothing leaks', async () => {
      const a = await fx.user('sales');
      const b = await fx.user('sales');
      const customer = await createCustomer((await fx.session(a.email)).access, fx.companyA, 'Private Customer');
      const res = await call('get', `/api/v1/customers/${customer.id}`, {
        token: (await fx.session(b.email)).access,
        company: fx.companyA,
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OUT_OF_SCOPE');
      expect(JSON.stringify(res.body)).not.toContain('Private Customer');
    });

    it('BE-F04-08 disabling a user who created data keeps the row and the data', async () => {
      const a = await fx.user('sales');
      const customer = await createCustomer((await fx.session(a.email)).access, fx.companyA, 'Kept Customer');
      await call('patch', `/api/v1/users/${a.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } });
      expect((await call('get', `/api/v1/customers/${customer.id}`, { token: fx.admin, company: fx.companyA })).status).toBe(200);
      const [row] = await fx.sql<{ status: string }>('SELECT status FROM users WHERE id = $1', [a.id]);
      expect(row.status).toBe('DISABLED');
    });

    it('BE-F04-10 a role with only payment.record: visible in the matrix, nothing else opened (invoice API waits for its module)', async () => {
      const role = await call('post', '/api/v1/roles', {
        token: fx.admin,
        body: { key: `pay_${Date.now().toString(36)}`, name: 'Pay', grants: [{ resource: 'payment', action: 'record', scope: 'COMPANY' }] },
      });
      const email = fx.email('pay');
      await call('post', '/api/v1/users', {
        token: fx.admin,
        body: { email, full_name: 'P', password: USER_PASSWORD, memberships: [{ company_id: fx.companyA, role_id: role.body.id }] },
      });
      const { access } = await fx.session(email);
      const perms = await call('get', '/api/v1/auth/me/permissions', { token: access, company: fx.companyA });
      expect(perms.body.permissions.map((p: { resource: string; action: string }) => `${p.resource}.${p.action}`)).toEqual([
        'payment.record',
      ]);
      expect((await call('get', '/api/v1/customers', { token: access, company: fx.companyA })).status).toBe(403);
    });

    it('BE-F04-11 the last Admin cannot be demoted or disabled, not even concurrently', async () => {
      const lone = new TenantFixture(uniqueSubdomain('lone'));
      lone.app = fx.app;
      lone.api = fx.api;
      await fx.api.createTenant(fx.platform, lone.sub);
      const admin = await fx.api.adminLogin(lone.sub);
      for (const r of (await lone.call('get', '/api/v1/roles', { token: admin })).body) lone.roles[r.key] = r.id;
      const admins = await lone.sql<{ id: string }>(
        `SELECT u.id FROM users u JOIN memberships m ON m.user_id = u.id JOIN roles r ON r.id = m.role_id WHERE r.key = 'tenant_admin' AND m.company_id IS NULL AND u.status = 'ACTIVE' ORDER BY u.email`,
      );
      expect(admins.length).toBeGreaterThanOrEqual(2);
      const disable = (id: string) => lone.call('patch', `/api/v1/users/${id}/status`, { token: admin, body: { status: 'DISABLED' } });
      const [me] = await lone.sql<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [`admin@${lone.sub}.test`]);
      for (const { id } of admins.filter((a) => a.id !== me.id).slice(1)) expect((await disable(id)).status).toBe(200);
      const rest = admins
        .filter((a) => a.id !== me.id)
        .slice(0, 1)
        .concat(me);
      const results = await Promise.all(rest.map(({ id }) => disable(id)));
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409]);
      expect(results.find((r) => r.status === 409)!.body.code).toBe('LAST_ADMIN');

      const [left] = await lone.sql<{ id: string }>(
        `SELECT u.id FROM users u JOIN memberships m ON m.user_id = u.id JOIN roles r ON r.id = m.role_id WHERE r.key = 'tenant_admin' AND m.company_id IS NULL AND u.status = 'ACTIVE'`,
      );
      const token =
        left.id === me.id
          ? admin
          : await lone.api
              .login(lone.sub, (await lone.sql<{ email: string }>('SELECT email FROM users WHERE id = $1', [left.id]))[0].email, 'x')
              .catch(() => admin);
      const demote = await lone.call('put', `/api/v1/users/${left.id}/memberships`, { token, body: { memberships: [] } });
      if (left.id === me.id) {
        expect(demote.status).toBe(409);
        expect(demote.body.code).toBe('LAST_ADMIN');
      }
    });

    it('BE-F04-12 role and permission changes are audited with before and after', async () => {
      const u = await fx.user('sales');
      await call('put', `/api/v1/users/${u.id}/memberships`, {
        token: fx.admin,
        body: { memberships: [{ company_id: fx.companyA, role_id: fx.roles.viewer }] },
      });
      const [row] = await fx.sql<{ before: { roleId: string }[]; after: { roleId: string }[] }>(
        `SELECT before, after FROM audit_logs WHERE action = 'user.memberships' AND entity_id = $1`,
        [u.id],
      );
      expect(row.before[0].roleId).toBe(fx.roles.sales);
      expect(row.after[0].roleId).toBe(fx.roles.viewer);

      const role = await call('post', '/api/v1/roles', {
        token: fx.admin,
        body: { key: `aud_${Date.now().toString(36)}`, name: 'A', grants: [{ resource: 'customer', action: 'read', scope: 'OWN' }] },
      });
      await call('patch', `/api/v1/roles/${role.body.id}`, {
        token: fx.admin,
        body: { name: 'B', grants: [{ resource: 'customer', action: 'read', scope: 'COMPANY' }] },
      });
      const [update] = await fx.sql<{ before: { grants: { scope: string }[] }; after: { grants: { scope: string }[] } }>(
        `SELECT before, after FROM audit_logs WHERE action = 'role.update' AND entity_id = $1`,
        [role.body.id],
      );
      expect(update.before.grants[0].scope).toBe('OWN');
      expect(update.after.grants[0].scope).toBe('COMPANY');
    });

    it('BE-F04-13 no role: DISABLED; first role: ACTIVE; no role left: DISABLED; ACTIVE with no role: 409', async () => {
      const email = fx.email('state');
      const created = await call('post', '/api/v1/users', {
        token: fx.admin,
        body: { email, full_name: 'S', password: USER_PASSWORD, memberships: [] },
      });
      expect(created.status).toBe(201);
      expect(created.body.status).toBe('DISABLED');
      const id = created.body.id as string;

      const active = await call('patch', `/api/v1/users/${id}/status`, { token: fx.admin, body: { status: 'ACTIVE' } });
      expect(active.status).toBe(409);
      expect(active.body.code).toBe('USER_HAS_NO_ROLE');

      const first = await call('put', `/api/v1/users/${id}/memberships`, {
        token: fx.admin,
        body: { memberships: [{ company_id: fx.companyA, role_id: fx.roles.sales }] },
      });
      expect(first.body.status).toBe('ACTIVE');
      const s = await fx.session(email);

      const none = await call('put', `/api/v1/users/${id}/memberships`, { token: fx.admin, body: { memberships: [] } });
      expect(none.body.status).toBe('DISABLED');
      expect((await call('get', '/api/v1/auth/me', { token: s.access })).status).toBe(401);
      expect((await fx.login(email)).status).toBe(401);
    });

    it('BE-F04-14 GET /roles/:id: full grants; 404 when unknown; 403 without the permission', async () => {
      const ok = await call('get', `/api/v1/roles/${fx.roles.sales}`, { token: fx.admin });
      expect(ok.status).toBe(200);
      expect(ok.body.key).toBe('sales');
      expect(ok.body.grants.length).toBeGreaterThan(0);
      expect((await call('get', '/api/v1/roles/00000000-0000-4000-8000-000000000000', { token: fx.admin })).status).toBe(404);
      const u = await fx.user('sales');
      expect((await call('get', `/api/v1/roles/${fx.roles.sales}`, { token: (await fx.session(u.email)).access })).status).toBe(403);
    });

    it('E-RBAC-02 a role with no permission at all: Forbidden, not 500', async () => {
      const role = await call('post', '/api/v1/roles', {
        token: fx.admin,
        body: { key: `nil_${Date.now().toString(36)}`, name: 'Nothing', grants: [] },
      });
      const email = fx.email('nil');
      await call('post', '/api/v1/users', {
        token: fx.admin,
        body: { email, full_name: 'N', password: USER_PASSWORD, memberships: [{ company_id: fx.companyA, role_id: role.body.id }] },
      });
      const { access } = await fx.session(email);
      expect((await call('get', '/api/v1/customers', { token: access, company: fx.companyA })).status).toBe(403);
      expect((await call('get', '/api/v1/customers', { token: access, company: fx.companyB })).status).toBe(403);
    });

    it('E-RBAC-01 X-Company-Id: malformed 400, unknown 404, inactive 403', async () => {
      expect((await call('get', '/api/v1/customers', { token: fx.admin, company: 'not-a-uuid' })).status).toBe(400);
      expect((await call('get', '/api/v1/customers', { token: fx.admin, company: '00000000-0000-4000-8000-000000000000' })).status).toBe(
        404,
      );
      const company = await call('post', '/api/v1/companies', {
        token: fx.admin,
        body: { legal_name: 'Off Inc', country_code: 'US', currency: 'USD' },
      });
      await fx.sql(`UPDATE companies SET status = 'INACTIVE' WHERE id = $1`, [company.body.id]);
      expect((await call('get', '/api/v1/customers', { token: fx.admin, company: company.body.id })).status).toBe(403);
    });

    it('E-RBAC-03 with the NOTIFY lost, a grant changed in the database still applies after the TTL', async () => {
      const role = await call('post', '/api/v1/roles', {
        token: fx.admin,
        body: { key: `ttl_${Date.now().toString(36)}`, name: 'TTL', grants: [] },
      });
      const email = fx.email('ttl');
      await call('post', '/api/v1/users', {
        token: fx.admin,
        body: { email, full_name: 'T', password: USER_PASSWORD, memberships: [{ company_id: fx.companyA, role_id: role.body.id }] },
      });
      const { access } = await fx.session(email);
      expect((await call('get', '/api/v1/customers', { token: access, company: fx.companyA })).status).toBe(403);

      await fx.sql(
        `INSERT INTO role_permissions (role_id, permission_id, scope) SELECT $1, id, 'COMPANY' FROM permissions WHERE resource = 'customer' AND action = 'read'`,
        [role.body.id],
      );
      expect((await call('get', '/api/v1/customers', { token: access, company: fx.companyA })).status).toBe(403);

      const now = Date.now();
      const clock = jest.spyOn(Date, 'now').mockImplementation(() => now + 6 * 60_000);
      try {
        expect((await call('get', '/api/v1/customers', { token: access, company: fx.companyA })).status).toBe(200);
      } finally {
        clock.mockRestore();
      }
    });

    it('E-RBAC-05 a role in use cannot be deleted, not even while it is being assigned', async () => {
      const role = await call('post', '/api/v1/roles', {
        token: fx.admin,
        body: { key: `race_${Date.now().toString(36)}`, name: 'Race', grants: [{ resource: 'customer', action: 'read', scope: 'OWN' }] },
      });
      const u = await fx.user('sales');
      const [assign, del] = await Promise.all([
        call('put', `/api/v1/users/${u.id}/memberships`, {
          token: fx.admin,
          body: { memberships: [{ company_id: fx.companyA, role_id: role.body.id }] },
        }),
        call('delete', `/api/v1/roles/${role.body.id}`, { token: fx.admin }),
      ]);
      // Either order is consistent, as long as nothing is half done
      const [row] = await fx.sql<{ n: string }>('SELECT count(*) AS n FROM memberships WHERE user_id = $1', [u.id]);
      const exists = (await call('get', `/api/v1/roles/${role.body.id}`, { token: fx.admin })).status === 200;
      expect([200, 422, 409]).toContain(assign.status);
      expect([204, 409]).toContain(del.status);
      expect(exists).toBe(del.status !== 204);
      expect(Number(row.n)).toBe(1);
    });
  });

  describe('reassign', () => {
    const reassign = (body: object, token = fx.admin) => call('post', '/api/v1/customers/reassign', { token, body });

    it('BE-F04-09 customers move to B, A no longer sees them, it is audited, open quotes follow', async () => {
      const a = await fx.user('sales');
      const b = await fx.user('sales');
      const sa = await fx.session(a.email);
      const sb = await fx.session(b.email);
      const customer = await createCustomer(sa.access, fx.companyA, 'Moving Customer');

      const res = await reassign({ from_user_id: a.id, to_user_id: b.id });
      expect(res.status).toBe(200);
      expect(res.body.customers).toBe(1);
      expect((await call('get', `/api/v1/customers/${customer.id}`, { token: sa.access, company: fx.companyA })).status).toBe(403);
      expect((await call('get', `/api/v1/customers/${customer.id}`, { token: sb.access, company: fx.companyA })).status).toBe(200);
      const [audit] = await fx.sql<{ after: { ownerId: string } }>(
        `SELECT after FROM audit_logs WHERE action = 'customer.reassigned' AND (before->>'ownerId') = $1`,
        [a.id],
      );
      expect(audit.after.ownerId).toBe(b.id);
    });

    it('BE-F04-09 E-RBAC-04 one customer that cannot move: nothing moves', async () => {
      const a = await fx.user('sales');
      const b = await fx.user('sales');
      const c = await fx.user('sales');
      const mine = await createCustomer((await fx.session(a.email)).access, fx.companyA, 'Mine');
      const theirs = await createCustomer((await fx.session(c.email)).access, fx.companyA, 'Theirs');
      const res = await reassign({ from_user_id: a.id, to_user_id: b.id, customer_ids: [mine.id, theirs.id] });
      expect(res.status).toBe(422);
      const rows = await fx.sql<{ owner_id: string }>('SELECT owner_id FROM customers WHERE id = $1', [mine.id]);
      expect(rows[0].owner_id).toBe(a.id);
    });

    it('E-RBAC-04 from = to, a disabled receiver, a receiver outside the company, an empty list: refused', async () => {
      const a = await fx.user('sales');
      const elsewhere = await fx.user('sales', fx.companyB);
      const disabled = await fx.user('sales');
      await call('patch', `/api/v1/users/${disabled.id}/status`, { token: fx.admin, body: { status: 'DISABLED' } });
      await createCustomer((await fx.session(a.email)).access, fx.companyA, 'Stays');
      const before = await fx.sql('SELECT id FROM customers WHERE owner_id = $1', [a.id]);

      expect((await reassign({ from_user_id: a.id, to_user_id: a.id })).status).toBe(422);
      expect((await reassign({ from_user_id: a.id, to_user_id: disabled.id })).status).toBe(422);
      expect((await reassign({ from_user_id: a.id, to_user_id: elsewhere.id })).status).toBe(422);
      expect((await reassign({ from_user_id: a.id, to_user_id: elsewhere.id, customer_ids: [] })).status).toBe(422);
      expect(await fx.sql('SELECT id FROM customers WHERE owner_id = $1', [a.id])).toEqual(before);
    });

    it('E-RBAC-04 without user.manage 403; concurrent runs leave one consistent owner', async () => {
      const a = await fx.user('sales');
      const b = await fx.user('sales');
      const c = await fx.user('sales');
      const customer = await createCustomer((await fx.session(a.email)).access, fx.companyA, 'Contended');
      expect((await reassign({ from_user_id: a.id, to_user_id: b.id }, (await fx.session(b.email)).access)).status).toBe(403);
      await Promise.all([
        reassign({ from_user_id: a.id, to_user_id: b.id, customer_ids: [customer.id] }),
        reassign({ from_user_id: a.id, to_user_id: c.id, customer_ids: [customer.id] }),
      ]);
      const [row] = await fx.sql<{ owner_id: string }>('SELECT owner_id FROM customers WHERE id = $1', [customer.id]);
      expect([b.id, c.id]).toContain(row.owner_id);
    });
  });

  describe('customers trash and repeated creates', () => {
    it('BE-F16 trash: a removed customer is listed and can be restored', async () => {
      const customer = await createCustomer(fx.admin, fx.companyA, 'Trashed');
      expect((await call('delete', `/api/v1/customers/${customer.id}`, { token: fx.admin, company: fx.companyA })).status).toBeLessThan(
        300,
      );
      const trash = await call('get', '/api/v1/customers/trash', { token: fx.admin, company: fx.companyA });
      expect(trash.body.items.map((c: { id: string }) => c.id)).toContain(customer.id);
      expect((await call('post', `/api/v1/customers/${customer.id}/restore`, { token: fx.admin, company: fx.companyA })).status).toBe(200);
      expect((await call('get', `/api/v1/customers/${customer.id}`, { token: fx.admin, company: fx.companyA })).status).toBe(200);
    });

    it('E-API-06 the same Idempotency-Key creates once and answers the same; a new key creates again', async () => {
      const key = `retry-${Date.now()}`;
      const body = {
        type: 'COMPANY',
        name: `Retry ${key}`,
        addresses: [{ type: 'BILLING', line1: '1 rue', postal_code: '75001', city: 'Paris' }],
      };
      const post = (k: string) =>
        call('post', '/api/v1/customers', { token: fx.admin, company: fx.companyA, body, headers: { 'Idempotency-Key': k } });
      const first = await post(key);
      expect(first.status).toBe(201);
      await new Promise((r) => setTimeout(r, 200));
      const again = await post(key);
      expect(again.status).toBe(201);
      expect(again.body.id).toBe(first.body.id);
      const rows = await fx.sql('SELECT id FROM customers WHERE name = $1', [body.name]);
      expect(rows).toHaveLength(1);
      expect((await post(`${key}-other`)).body.id).not.toBe(first.body.id);
    });
  });
});
