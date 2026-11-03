import { Prisma } from '../../generated/tenant/client';
import { keysToCamel, keysToSnake, nonSnakeKeys, toCamel, toSnake, toSnakePath } from './case-conversion';
import { SnakeCaseRequestPipe } from './snake-case.pipe';

describe('case conversion', () => {
  it.each([
    ['companyLegalName', 'company_legal_name'],
    ['addressLine1', 'address_line1'],
    ['line1', 'line1'],
    ['id', 'id'],
  ])('%s <-> %s', (camel, snake) => {
    expect(toSnake(camel)).toBe(snake);
    expect(toCamel(snake)).toBe(camel);
  });

  it('converts nested objects and arrays, leaving Date and Decimal values intact', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const amount = new Prisma.Decimal('12.50');
    const out = keysToSnake({
      totalHt: amount,
      createdAt: date,
      contacts: [{ firstName: 'A', isPrimary: true }],
      tags: ['vipClient'],
    }) as Record<string, unknown>;
    expect(out).toEqual({ total_ht: amount, created_at: date, contacts: [{ first_name: 'A', is_primary: true }], tags: ['vipClient'] });
    expect(out.total_ht).toBe(amount);
    expect(keysToCamel({ page_size: 20, addresses: [{ postal_code: '75001' }] })).toEqual({
      pageSize: 20,
      addresses: [{ postalCode: '75001' }],
    });
  });

  it('converts error field paths', () => {
    expect(toSnakePath('memberships.0.roleId')).toBe('memberships.0.role_id');
  });

  it('lists camelCase keys anywhere in the payload', () => {
    expect(nonSnakeKeys({ ok_key: 1, badKey: 2, nested: [{ alsoBad: true }] })).toEqual(['badKey', 'nested.0.alsoBad']);
  });
});

describe('SnakeCaseRequestPipe', () => {
  const pipe = new SnakeCaseRequestPipe();

  it('converts body and query to camelCase for the DTOs', () => {
    expect(pipe.transform({ legal_name: 'X' }, { type: 'body' })).toEqual({ legalName: 'X' });
    expect(pipe.transform({ page_size: '5' }, { type: 'query' })).toEqual({ pageSize: '5' });
  });

  it('rejects camelCase keys with 422', () => {
    expect(() => pipe.transform({ legalName: 'X' }, { type: 'body' })).toThrow(
      expect.objectContaining({ status: 422, fields: [expect.objectContaining({ field: 'legalName', code: 'snakeCase' })] }),
    );
  });

  it('leaves params and custom arguments untouched', () => {
    expect(pipe.transform('someId', { type: 'param' })).toBe('someId');
    const access = { userId: 'u' };
    expect(pipe.transform(access, { type: 'custom' })).toBe(access);
  });
});
