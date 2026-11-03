import { PERMISSIONS } from '../../modules/rbac/permission-catalog';
import { PLATFORM_PERMISSIONS } from '../../modules/rbac/platform-catalog';
import { compareCodeUnits } from './compare-code-units';

describe('compareCodeUnits', () => {
  it('sorts exactly as sort() without a compare function, not as localeCompare', () => {
    const values = [
      'tenant',
      'Tenant',
      'audit',
      'Zebra',
      'zebra',
      'export_fec',
      'export.fec',
      'é',
      'e',
      'f',
      'Đ',
      '10',
      '9',
      '',
      '😀',
      'a b',
      'a_b',
      'a-b',
    ];
    const sorted = [...values].sort(compareCodeUnits);
    expect(sorted).toEqual([...values].sort());
    expect(sorted).not.toEqual([...values].sort((a, b) => a.localeCompare(b)));
  });

  it('gives the order the API has always returned for the real permission catalogs', () => {
    const lists = [
      PERMISSIONS.map((p) => p.resource),
      PERMISSIONS.map((p) => p.action),
      PERMISSIONS.map((p) => `${p.resource}.${p.action}`),
      PLATFORM_PERMISSIONS.map(([resource]) => resource),
      PLATFORM_PERMISSIONS.map(([resource, action]) => `${resource}.${action}`),
    ];
    for (const list of lists) expect([...list].sort(compareCodeUnits)).toEqual([...list].sort());
  });

  it('keeps equal values equal', () => {
    expect(compareCodeUnits('a', 'a')).toBe(0);
  });
});
