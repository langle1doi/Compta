// Keys that must never reach an audit row, whatever the caller passes.
const SECRET_KEY_PATTERNS = [
  /pass|token|secret|hash|credential|connection|recovery/i,
  /api_?key|invite_?url|mfa_?code/i,
  /enc$|^db[_A-Z]|^code$|^otp$/i,
];

const isSecretKey = (key: string) => SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));

/** Above this the content is replaced by a note: an audit row must not grow without limit (E-AUD-02). */
export const AUDIT_VALUE_MAX_BYTES = 32 * 1024;

/** Deep copy without secrets, ready to store as JSON. Dates become ISO strings, binary is dropped. */
export function sanitizeAudit<T>(value: T): T {
  const clean = walk(value);
  if (clean === null || clean === undefined) return clean as T;
  const size = Buffer.byteLength(JSON.stringify(clean));
  return (size > AUDIT_VALUE_MAX_BYTES ? { _truncated: true, size_bytes: size } : clean) as T;
}

function walk(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return '[binary]';
  if (Array.isArray(value)) return value.map(walk);
  if (typeof value !== 'object') return value;
  // Prisma Decimal and the like serialize themselves
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return (value as { toJSON(): unknown }).toJSON();
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSecretKey(key))
      .map(([key, v]) => [key, walk(v)]),
  );
}
