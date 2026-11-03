import type { Adapter, Enforcer, Model } from 'casbin';
import type { ControlEventsService } from '../../../database/control-events.service';
import { DataScope } from '../../../generated/tenant/enums';
import { EnforcerService } from '../enforcer.service';
import { createEnforcer } from './create-enforcer';
import { effectiveScope } from './subjects';

const COMPANY_A = 'aaaaaaaa-0000-0000-0000-000000000000';
const COMPANY_B = 'bbbbbbbb-0000-0000-0000-000000000000';

class InMemoryAdapter implements Adapter {
  constructor(
    private readonly p: string[][],
    private readonly g: string[][],
  ) {}
  async loadPolicy(model: Model) {
    this.p.forEach((rule) => model.addPolicy('p', 'p', rule));
    this.g.forEach((rule) => model.addPolicy('g', 'g', rule));
  }
  async savePolicy() {
    return false;
  }
  async addPolicy() {}
  async removePolicy() {}
  async removeFilteredPolicy() {}
}

describe('Casbin RBAC model', () => {
  const service = new EnforcerService({ subscribe: () => undefined } as unknown as ControlEventsService);
  let enforcer: Enforcer;
  const scope = (user: string, company: string | null, obj: string, act: string) => service.resolveScope(enforcer, user, company, obj, act);

  beforeAll(async () => {
    enforcer = await createEnforcer(
      new InMemoryAdapter(
        [
          ['role:admin', 'user', 'manage', 'TENANT'],
          ['role:admin', 'customer', 'read', 'TENANT'],
          ['role:owner', 'quote', 'read', 'COMPANY'],
          ['role:owner', 'invoice', 'validate', 'COMPANY'],
          ['role:sales', 'customer', 'read', 'OWN'],
          ['role:sales', 'customer', 'write', 'OWN'],
          ['role:viewer', 'customer', 'read', 'COMPANY'],
          // A role that grants TENANT scope, assigned to a single company below
          ['role:custom_tenant', 'user', 'manage', 'TENANT'],
          ['role:custom_tenant', 'customer', 'read', 'TENANT'],
          // Wildcards are not supported: this policy must never match anything
          ['role:wild', '*', '*', 'TENANT'],
        ],
        [
          ['user:admin', 'role:admin', '*'],
          ['user:owner', 'role:owner', `company:${COMPANY_A}`],
          ['user:sales', 'role:sales', `company:${COMPANY_A}`],
          ['user:multi', 'role:sales', `company:${COMPANY_A}`],
          ['user:multi', 'role:owner', `company:${COMPANY_B}`],
          ['user:escalate', 'role:custom_tenant', `company:${COMPANY_A}`],
          ['user:tenantviewer', 'role:viewer', '*'],
          ['user:wild', 'role:wild', '*'],
        ],
      ),
    );
  });

  it('tenant admin gets TENANT scope in any company and without a company', async () => {
    expect(await scope('admin', COMPANY_A, 'customer', 'read')).toBe(DataScope.TENANT);
    expect(await scope('admin', COMPANY_B, 'customer', 'read')).toBe(DataScope.TENANT);
    expect(await scope('admin', null, 'user', 'manage')).toBe(DataScope.TENANT);
  });

  it('sales only gets OWN scope on their customers', async () => {
    expect(await scope('sales', COMPANY_A, 'customer', 'read')).toBe(DataScope.OWN);
    expect(await scope('sales', COMPANY_A, 'customer', 'delete')).toBeNull();
    expect(await scope('sales', COMPANY_A, 'invoice', 'validate')).toBeNull();
  });

  it('memberships do not leak across companies', async () => {
    expect(await scope('owner', COMPANY_B, 'quote', 'read')).toBeNull();
    expect(await scope('sales', null, 'customer', 'read')).toBeNull();
  });

  it('a user can hold different roles in different companies', async () => {
    expect(await scope('multi', COMPANY_A, 'customer', 'read')).toBe(DataScope.OWN);
    expect(await scope('multi', COMPANY_A, 'invoice', 'validate')).toBeNull();
    expect(await scope('multi', COMPANY_B, 'invoice', 'validate')).toBe(DataScope.COMPANY);
    expect(await scope('multi', COMPANY_B, 'customer', 'read')).toBeNull();
  });

  it('a company-bound membership is capped at COMPANY even if the role grants TENANT (no escalation)', async () => {
    expect(await scope('escalate', COMPANY_A, 'user', 'manage')).toBe(DataScope.COMPANY);
    expect(await scope('escalate', COMPANY_A, 'customer', 'read')).toBe(DataScope.COMPANY);
    expect(await scope('escalate', null, 'user', 'manage')).toBeNull();
    expect(await scope('escalate', COMPANY_B, 'user', 'manage')).toBeNull();
  });

  it('a tenant-wide membership applies in every company at the role scope', async () => {
    expect(await scope('tenantviewer', COMPANY_A, 'customer', 'read')).toBe(DataScope.COMPANY);
    expect(await scope('tenantviewer', COMPANY_B, 'customer', 'read')).toBe(DataScope.COMPANY);
  });

  it('wildcard policies grant nothing', async () => {
    expect(await scope('wild', COMPANY_A, 'customer', 'read')).toBeNull();
    expect(await scope('wild', null, 'user', 'manage')).toBeNull();
  });

  it('unknown users are denied', async () => {
    expect(await scope('nobody', COMPANY_A, 'customer', 'read')).toBeNull();
  });
});

describe('effectiveScope (scope shown by GET /auth/me)', () => {
  const service = new EnforcerService({ subscribe: () => undefined } as unknown as ControlEventsService);
  const SCOPES = Object.values(DataScope);

  it.each(SCOPES)('grant %s: gives the same scope as the Casbin matcher, company-bound and tenant-wide', async (granted) => {
    const enforcer = await createEnforcer(
      new InMemoryAdapter(
        [['role:r', 'customer', 'read', granted]],
        [
          ['user:bound', 'role:r', `company:${COMPANY_A}`],
          ['user:wide', 'role:r', '*'],
        ],
      ),
    );
    expect(effectiveScope(granted, COMPANY_A)).toBe(await service.resolveScope(enforcer, 'bound', COMPANY_A, 'customer', 'read'));
    expect(effectiveScope(granted, null)).toBe(await service.resolveScope(enforcer, 'wide', COMPANY_A, 'customer', 'read'));
    expect(effectiveScope(granted, null)).toBe(await service.resolveScope(enforcer, 'wide', null, 'customer', 'read'));
  });

  it('caps TENANT at COMPANY only on a company-bound membership', () => {
    expect(effectiveScope(DataScope.TENANT, COMPANY_A)).toBe(DataScope.COMPANY);
    expect(effectiveScope(DataScope.TENANT, null)).toBe(DataScope.TENANT);
    expect(effectiveScope(DataScope.OWN, COMPANY_A)).toBe(DataScope.OWN);
  });
});
