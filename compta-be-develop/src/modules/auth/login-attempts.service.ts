import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, User } from '../../generated/tenant/client';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { accountLockedMail } from '../mail/mail-templates';
import { MailService } from '../mail/mail.service';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { isLocked, LockoutPolicy, recordFailedLogin } from './login-lockout';

// Parallel attempts of one user wait for each other; each lasts one password hash at most
const BURST_WAIT_MS = 15_000;

export type AttemptResult<T> = { outcome: 'passed'; value: T } | { outcome: 'wrong' } | { outcome: 'refused' };

/**
 * Everything that tests a password or a 2FA code counts on the same lock, per user: at login and also behind a session,
 * so that a stolen session cannot guess freely (E-MFA-04).
 */
@Injectable()
export class LoginAttemptsService {
  private readonly logger = new Logger(LoginAttemptsService.name);
  private readonly policy: LockoutPolicy;

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.policy = {
      maxAttempts: config.getOrThrow<number>('LOGIN_MAX_ATTEMPTS'),
      lockMinutes: config.getOrThrow<number>('LOGIN_LOCK_MINUTES'),
    };
  }

  /**
   * Runs `test` with the user row locked: a burst, from any address and any pod, tests one secret at a time and each
   * sees the lock the previous failure may have set. `test` answers null when the secret is wrong. A locked account is
   * refused without testing anything, so the right secret tells nothing either.
   */
  async attempt<T>(
    userId: string,
    actor: AuditActor,
    failureAction: string,
    test: (tx: Prisma.TransactionClient, user: User) => Promise<T | null>,
    allowed: (user: User) => boolean = () => true,
  ): Promise<AttemptResult<T>> {
    const result = await this.tenantDb.client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || isLocked(user.lockedUntil) || !allowed(user)) return { outcome: 'refused' as const };
        const value = await test(tx, user);
        if (value !== null) return { outcome: 'passed' as const, value };
        const { justLocked } = await recordFailedLogin(tx, 'users', userId, this.policy);
        return { outcome: 'wrong' as const, email: user.email, justLocked };
      },
      { maxWait: BURST_WAIT_MS, timeout: BURST_WAIT_MS },
    );
    if (result.outcome === 'wrong') await this.report(userId, result.email, result.justLocked, actor, failureAction);
    return result;
  }

  /** A wrong password at login. */
  async recordLoginFailure(userId: string, email: string, actor: AuditActor) {
    const { justLocked } = await recordFailedLogin(this.tenantDb.client, 'users', userId, this.policy);
    await this.report(userId, email, justLocked, actor, 'auth.login_failed');
  }

  private async report(userId: string, email: string, justLocked: boolean, actor: AuditActor, action: string) {
    await this.audit.recordSafe(actor, { action, entity: 'user', entityId: userId });
    if (!justLocked) return;
    await this.audit.recordSafe(actor, { action: 'auth.account_locked', entity: 'user', entityId: userId });
    // F02 AC-03. A mail problem must not change the answer to the request
    await this.mail
      .enqueue('account_locked', this.tenantDb.tenantId, { to: email, ...accountLockedMail(this.policy.lockMinutes) })
      .catch((error: { code?: string }) => {
        this.logger.warn({ errorCode: error.code }, 'Account lock warning could not be queued');
      });
  }
}
