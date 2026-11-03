import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Secret, TOTP } from 'otpauth';
import { toDataURL } from 'qrcode';
import { hashOpaqueToken } from '../../common/crypto/opaque-token';
import { decryptSecret, encryptSecret } from '../../common/crypto/secret-box';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { Prisma } from '../../generated/tenant/client';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { LoginAttemptsService } from './login-attempts.service';
import { verifyPassword } from './password';
import { UserStateService } from './user-state.service';

const RECOVERY_CODES = 10;
const STEP_SECONDS = 30;
const ISSUER = 'COMPTA';

const invalidCode = () =>
  new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.MFA_INVALID_CODE, 'Invalid code', [
    { field: 'code', code: ErrorCode.MFA_INVALID_CODE, message: 'Invalid code' },
  ]);

const normalizeCode = (code: string) => code.replace(/[\s-]/g, '').toLowerCase();

/** Which 30-second step `code` belongs to, within ±1 step of `now` (F02 AC-02); null when it matches none. */
export function matchTotpStep(secretBase32: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const totp = new TOTP({ issuer: ISSUER, algorithm: 'SHA1', digits: 6, period: STEP_SECONDS, secret: Secret.fromBase32(secretBase32) });
  const delta = totp.validate({ token: code, timestamp: now, window: 1 });
  return delta === null ? null : Math.floor(now / 1000 / STEP_SECONDS) + delta;
}

@Injectable()
export class MfaService {
  private readonly key: string;

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly userState: UserStateService,
    private readonly attempts: LoginAttemptsService,
    config: ConfigService,
  ) {
    this.key = config.getOrThrow<string>('DB_CREDENTIALS_KEY');
  }

  /** A new setup replaces an unconfirmed one (E-MFA-02). 2FA stays off until a code proves the user has the secret. */
  async setup(userId: string) {
    const db = this.tenantDb.client;
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, mfaEnabled: true } });
    if (user.mfaEnabled) throw new AppException(HttpStatus.CONFLICT, ErrorCode.MFA_ALREADY_ENABLED, '2FA is already enabled');

    const secret = new Secret({ size: 20 });
    const totpSecretEnc = encryptSecret(secret.base32, this.key);
    await db.userMfa.upsert({
      where: { userId },
      create: { userId, totpSecretEnc },
      update: { totpSecretEnc, confirmedAt: null, lastUsedStep: null },
    });
    const otpauthUrl = new TOTP({
      issuer: ISSUER,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: STEP_SECONDS,
      secret,
    }).toString();
    return { secret: secret.base32, otpauthUrl, qrCode: await toDataURL(otpauthUrl) };
  }

  /** Recovery codes are shown once, here, and stored hashed. */
  async confirm(userId: string, code: string, actor: AuditActor) {
    const db = this.tenantDb.client;
    const mfa = await db.userMfa.findUnique({ where: { userId } });
    if (!mfa || mfa.confirmedAt) throw new AppException(HttpStatus.CONFLICT, ErrorCode.MFA_NOT_PENDING, 'No 2FA setup in progress');
    const step = matchTotpStep(decryptSecret(mfa.totpSecretEnc, this.key), normalizeCode(code));
    if (step === null) throw invalidCode();

    const recoveryCodes = Array.from({ length: RECOVERY_CODES }, () => randomBytes(10).toString('hex'));
    await db.$transaction(async (tx) => {
      await tx.userMfa.update({ where: { userId }, data: { confirmedAt: new Date(), lastUsedStep: step } });
      await tx.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((c) => ({ userId, codeHash: hashOpaqueToken(c) })) });
      await this.audit.record(actor, { action: 'auth.mfa_enabled', entity: 'user', entityId: userId }, tx);
    });
    await this.userState.changed(this.tenantDb.tenantId, userId);
    return { recoveryCodes };
  }

  /**
   * A TOTP code or a recovery code; null when wrong. Both are consumed atomically: the same TOTP step cannot be used
   * twice (E-MFA-01) and a recovery code only once (BE-F02-34), even with parallel requests.
   */
  async verifyCode(userId: string, code: string, db: Prisma.TransactionClient = this.tenantDb.client): Promise<'totp' | 'recovery' | null> {
    const mfa = await db.userMfa.findUnique({ where: { userId } });
    if (!mfa?.confirmedAt) return null;
    const clean = normalizeCode(code);
    const step = matchTotpStep(decryptSecret(mfa.totpSecretEnc, this.key), clean);
    if (step !== null) {
      const { count } = await db.userMfa.updateMany({
        where: { userId, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
        data: { lastUsedStep: step },
      });
      return count === 1 ? 'totp' : null;
    }
    const { count } = await db.mfaRecoveryCode.updateMany({
      where: { userId, codeHash: hashOpaqueToken(clean), usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1 ? 'recovery' : null;
  }

  /** Not while the role or the tenant requires 2FA (E-MFA-07). */
  async disable(userId: string, password: string, code: string, actor: AuditActor) {
    const db = this.tenantDb.client;
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { mfaEnabled: true } });
    if (!user.mfaEnabled) throw new AppException(HttpStatus.CONFLICT, ErrorCode.MFA_NOT_PENDING, '2FA is not enabled');
    if (await this.requiredFor(userId))
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.MFA_REQUIRED, '2FA is mandatory for your role');
    // A stolen session must not be able to guess: a wrong password or code counts toward the lock (E-MFA-04)
    const check = await this.attempts.attempt(userId, actor, 'auth.mfa_disable_failed', async (tx, row) => {
      if (!row.passwordHash || !(await verifyPassword(row.passwordHash, password))) return null;
      return (await this.verifyCode(userId, code, tx)) ?? null;
    });
    if (check.outcome !== 'passed') throw invalidCode();
    await this.clear(userId, actor, 'auth.mfa_disabled', false);
  }

  /**
   * Admin reset (F04): the user sets 2FA up again at next login, and their sessions end. Not on oneself, or a stolen
   * admin password could remove the second factor (E-MFA-06).
   */
  async adminReset(targetId: string, actor: AuditActor) {
    if (targetId === actor.userId) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.MFA_SELF_RESET_FORBIDDEN, 'Another administrator must reset your 2FA');
    }
    await this.clear(targetId, actor, 'user.mfa_reset', true);
  }

  private async clear(userId: string, actor: AuditActor, action: string, revokeSessions: boolean) {
    const db = this.tenantDb.client;
    const sessions = revokeSessions ? await db.session.findMany({ where: { userId, revokedAt: null }, select: { id: true } }) : [];
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, ...(revokeSessions && { tokenVersion: { increment: 1 } }) },
      });
      await tx.userMfa.deleteMany({ where: { userId } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      if (revokeSessions) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record(actor, { action, entity: 'user', entityId: userId }, tx);
    });
    await this.userState.changed(this.tenantDb.tenantId, userId);
    for (const { id } of sessions) await this.userState.sessionRevoked(this.tenantDb.tenantId, id);
  }

  private async requiredFor(userId: string) {
    // With 2FA temporarily considered off: would this user then be forced to set it up?
    const db = this.tenantDb.client;
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { memberships: { select: { role: { select: { key: true } } } } },
    });
    return this.userState.wouldRequireMfa(db, user);
  }
}
