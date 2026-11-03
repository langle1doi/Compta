import { DataScope } from '../../generated/tenant/enums';
import { Matrix, PRD_PERMISSION_MATRIX as EXPECTED } from '../../../test/fixtures/prd-permission-matrix';
import { PERMISSIONS, SYSTEM_ROLES } from './permission-catalog';

const { TENANT } = DataScope;

const actual = (key: string): Matrix => {
  const role = SYSTEM_ROLES.find((r) => r.key === key)!;
  return Object.fromEntries(role.grants.map((g) => [`${g.resource}.${g.action}`, g.scope]));
};

describe('system roles = PRD §1.8 matrix', () => {
  it('defines exactly the five system roles', () => {
    expect(SYSTEM_ROLES.map((r) => r.key).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  // Every role x every permission: granted with the exact scope, or not granted at all
  const codes = PERMISSIONS.map((p) => `${p.resource}.${p.action}`);
  for (const role of Object.keys(EXPECTED)) {
    it.each(codes)(`${role} / %s`, (code) => {
      expect(actual(role)[code]).toBe(EXPECTED[role][code]);
    });
  }

  it('grants only catalog permissions, never wildcards, never duplicated', () => {
    const catalog = new Set(codes);
    for (const role of SYSTEM_ROLES) {
      const granted = role.grants.map((g) => `${g.resource}.${g.action}`);
      expect(granted.filter((c) => !catalog.has(c))).toEqual([]);
      expect(new Set(granted).size).toBe(granted.length);
      expect(granted.some((c) => c.includes('*'))).toBe(false);
    }
  });

  it('keeps financial actions away from the tenant admin and the viewer', () => {
    const financial = ['quote.approve', 'invoice.create', 'invoice.validate', 'credit_note.create', 'payment.record', 'payment.reconcile'];
    for (const role of ['tenant_admin', 'viewer']) {
      expect(financial.filter((c) => actual(role)[c])).toEqual([]);
    }
  });

  it('only the tenant admin administers the tenant, always at TENANT scope', () => {
    for (const code of ['company.manage', 'settings.manage', 'user.manage', 'role.manage']) {
      const holders = SYSTEM_ROLES.filter((r) => actual(r.key)[code]).map((r) => r.key);
      expect({ code, holders }).toEqual({ code, holders: ['tenant_admin'] });
      expect(actual('tenant_admin')[code]).toBe(TENANT);
    }
  });

  it('audit log is limited to admin and owner; accountant and viewer cannot read it', () => {
    expect(
      SYSTEM_ROLES.filter((r) => actual(r.key)['audit.view'])
        .map((r) => r.key)
        .sort(),
    ).toEqual(['owner', 'tenant_admin']);
  });
});
