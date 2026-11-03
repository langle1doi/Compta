/**
 * JSON over the wire is snake_case (PRD ch.4); TypeScript/Prisma stay camelCase.
 * Only plain objects and arrays are walked: Date, Prisma Decimal, Buffer… are left untouched.
 */

export const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** "memberships.0.roleId" -> "memberships.0.role_id" */
export const toSnakePath = (path: string) => path.split('.').map(toSnake).join('.');

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function mapKeys(value: unknown, rename: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, rename));
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [rename(k), mapKeys(v, rename)]));
}

export const keysToSnake = <T>(value: T): unknown => mapKeys(value, toSnake);
export const keysToCamel = <T>(value: T): unknown => mapKeys(value, toCamel);

/** Paths of keys that are not snake_case (contain an uppercase letter). */
export function nonSnakeKeys(value: unknown, parent = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => nonSnakeKeys(v, parent ? `${parent}.${i}` : String(i)));
  if (!isPlainObject(value)) return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const path = parent ? `${parent}.${k}` : k;
    return [...(/[A-Z]/.test(k) ? [path] : []), ...nonSnakeKeys(v, path)];
  });
}
