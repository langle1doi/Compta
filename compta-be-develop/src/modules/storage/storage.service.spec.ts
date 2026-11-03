import { tenantObjectKey } from './storage.service';

const TENANT = '6f1c0000-0000-4000-8000-000000000001';

describe('tenantObjectKey', () => {
  it('puts every object under the tenant prefix', () => {
    expect(tenantObjectKey(TENANT, 'exports/a.zip')).toBe(`tenants/${TENANT}/exports/a.zip`);
    expect(tenantObjectKey(TENANT, '/exports/a.zip')).toBe(`tenants/${TENANT}/exports/a.zip`);
  });

  it.each(['../other/a.zip', 'a/../../b', 'a//b', '.', ''])('rejects the path %p', (path) => {
    expect(() => tenantObjectKey(TENANT, path)).toThrow('Invalid object path');
  });

  it('rejects anything that is not a tenant id', () => {
    expect(() => tenantObjectKey('../x', 'a.zip')).toThrow('Invalid tenant id');
  });
});
