import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateTenantToken, hashOpaqueToken } from '../../common/crypto/opaque-token';
import { AppException, fieldError } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { tenantPublicUrl } from '../../common/http/public-url';
import { CompanyStatus, UserStatus } from '../../generated/tenant/enums';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { passwordResetMail } from '../mail/mail-templates';
import { MailService } from '../mail/mail.service';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LoginAttemptsService } from './login-attempts.service';
import { hashPassword, verifyPassword } from './password';
import { UserStateService } from './user-state.service';

// F02 AC-04
const RESET_LINK_MINUTES = 60;

const invalidLink = () => new AppException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOKEN, 'This link is invalid or has expired');

const passwordReused = () =>
  new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.PASSWORD_REUSED, 'The new password must differ from the current one', [
    { field: 'new_password', code: ErrorCode.PASSWORD_REUSED, message: 'The new password must differ from the current one' },
  ]);

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  private readonly urlTemplate?: string;

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly userState: UserStateService,
    private readonly attempts: LoginAttemptsService,
    config: ConfigService,
  ) {
    this.urlTemplate = config.get<string>('APP_PUBLIC_URL_TEMPLATE');
  }

  /**
   * Answers the same whatever the address: the work happens after the response, so timing says nothing either.
   * Only ACTIVE users get a link: it must not activate an invited or disabled account (E-PWD-02).
   * A new request kills the previous link (E-PWD-01). The URL comes from configuration, never from the Host (E-PWD-05).
   */
  requestReset(email: string) {
    void this.sendResetLink(email).catch((error: { code?: string }) => {
      this.logger.error({ errorCode: error.code }, 'Password reset could not be prepared');
    });
  }

  private async sendResetLink(email: string) {
    const db = this.tenantDb.client;
    const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true } });
    if (user?.status !== UserStatus.ACTIVE) return;

    const { tenantId, subdomain } = this.tenantDb.context;
    const token = generateTenantToken(tenantId);
    await db.$transaction([
      db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      db.passwordReset.create({
        data: { userId: user.id, tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60_000) },
      }),
    ]);
    const url = tenantPublicUrl(this.urlTemplate, subdomain, `/reset-password?token=${encodeURIComponent(token)}`);
    await this.mail.enqueue('password_reset', tenantId, { to: email, ...passwordResetMail(url) });
    await this.audit.recordSafe({ type: null }, { action: 'auth.password_reset_requested', entity: 'user', entityId: user.id });
  }

  /** One use: of two parallel requests only one marks the row (E-PWD-03). A weak password was refused before this. */
  async resetPassword(token: string, newPassword: string, actor: AuditActor) {
    const db = this.tenantDb.client;
    const reset = await db.passwordReset.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      include: { user: { select: { id: true, status: true, passwordHash: true } } },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date() || reset.user.status !== UserStatus.ACTIVE) throw invalidLink();
    if (reset.user.passwordHash && (await verifyPassword(reset.user.passwordHash, newPassword))) throw passwordReused();

    const passwordHash = await hashPassword(newPassword);
    const userId = reset.user.id;
    const sessions = await db.session.findMany({ where: { userId, revokedAt: null }, select: { id: true } });
    await db.$transaction(async (tx) => {
      const { count } = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
      if (count !== 1) throw invalidLink();
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 }, failedLoginCount: 0, lastFailedLoginAt: null, lockedUntil: null },
      });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record({ ...actor, type: 'user', userId }, { action: 'auth.password_reset', entity: 'user', entityId: userId }, tx);
    });
    await this.userState.changed(this.tenantDb.tenantId, userId);
    for (const { id } of sessions) await this.userState.sessionRevoked(this.tenantDb.tenantId, id);
  }

  /** The other sessions end; the one making the change stays open. */
  async changePassword(userId: string, sessionId: string | undefined, currentPassword: string, newPassword: string, actor: AuditActor) {
    const db = this.tenantDb.client;
    // A stolen session must not be able to guess the password: wrong ones count toward the lock (E-MFA-04)
    const check = await this.attempts.attempt(userId, actor, 'auth.password_check_failed', async (_tx, user) =>
      user.passwordHash && (await verifyPassword(user.passwordHash, currentPassword)) ? user.passwordHash : null,
    );
    if (check.outcome !== 'passed') throw fieldError('current_password', 'invalid', 'Current password is incorrect');
    if (await verifyPassword(check.value, newPassword)) throw passwordReused();

    const passwordHash = await hashPassword(newPassword);
    const others = await db.session.findMany({ where: { userId, revokedAt: null, id: { not: sessionId } }, select: { id: true } });
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.session.updateMany({ where: { id: { in: others.map((s) => s.id) } }, data: { revokedAt: new Date() } });
      await this.audit.record(actor, { action: 'auth.password_changed', entity: 'user', entityId: userId }, tx);
    });
    for (const { id } of others) await this.userState.sessionRevoked(this.tenantDb.tenantId, id);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.lastCompanyId) await this.assertCanWorkIn(userId, dto.lastCompanyId);
    return this.tenantDb.client.user.update({
      where: { id: userId },
      data: dto,
      select: { id: true, email: true, fullName: true, phone: true, emailSignature: true, locale: true, lastCompanyId: true },
    });
  }

  private async assertCanWorkIn(userId: string, companyId: string) {
    const db = this.tenantDb.client;
    const [company, membership] = await Promise.all([
      db.company.findFirst({ where: { id: companyId, status: CompanyStatus.ACTIVE }, select: { id: true } }),
      db.membership.findFirst({ where: { userId, OR: [{ companyId }, { companyId: null }] }, select: { id: true } }),
    ]);
    if (!company || !membership) throw fieldError('last_company_id', 'notAccessible', 'Company is not accessible');
  }
}
