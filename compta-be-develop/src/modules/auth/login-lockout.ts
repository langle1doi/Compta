import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';

export interface LockoutPolicy {
  maxAttempts: number;
  /** Failures older than this no longer count; also how long the lock lasts (F02 AC-03: 5 failures / 15 minutes). */
  lockMinutes: number;
}

export interface FailedLoginResult {
  /** True for the single attempt that locked the account: that one sends the warning email. */
  justLocked: boolean;
}

interface RawClient {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * Counts a failure atomically in the database, so parallel attempts cannot be missed (E-AUTH-03).
 * The window restarts when the last failure is too old or a previous lock has ended (E-AUTH-04).
 */
export async function recordFailedLogin(
  db: RawClient,
  table: 'users' | 'platform_admins',
  id: string,
  policy: LockoutPolicy,
): Promise<FailedLoginResult> {
  const now = `(now() AT TIME ZONE 'UTC')`;
  const window = `make_interval(mins => ${Number(policy.lockMinutes)})`;
  const count = `CASE WHEN p.last_failed_login_at IS NULL OR p.last_failed_login_at <= ${now} - ${window} OR (p.locked_until IS NOT NULL AND p.locked_until <= ${now})
                      THEN 1 ELSE p.failed_login_count + 1 END`;
  const rows = await db.$queryRawUnsafe<{ just_locked: boolean }[]>(
    `WITH p AS (SELECT id, failed_login_count, last_failed_login_at, locked_until FROM "${table}" WHERE id = $1::uuid FOR UPDATE)
     UPDATE "${table}" t SET
       failed_login_count = ${count},
       last_failed_login_at = ${now},
       locked_until = CASE WHEN ${count} >= ${Number(policy.maxAttempts)} THEN ${now} + ${window}
                           WHEN p.locked_until > ${now} THEN p.locked_until ELSE NULL END
     FROM p WHERE t.id = p.id
     RETURNING (${count} >= ${Number(policy.maxAttempts)} AND (p.locked_until IS NULL OR p.locked_until <= ${now})) AS just_locked`,
    id,
  );
  return { justLocked: rows[0]?.just_locked === true };
}

export const isLocked = (lockedUntil: Date | null, now = new Date()) => !!lockedUntil && lockedUntil > now;

export const RESET_LOCKOUT = { failedLoginCount: 0, lastFailedLoginAt: null, lockedUntil: null };

/** Same answer for a wrong password, an unknown address, a locked or disabled account: nothing to learn from it. */
export const invalidCredentials = () =>
  new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
