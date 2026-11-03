import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessTokenService } from '../../../common/auth/access-token.service';
import { hashOpaqueToken } from '../../../common/crypto/opaque-token';
import { AppException, fieldError } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { ClientInfo } from '../../../common/http/client-info';
import { compareCodeUnits } from '../../../common/text/compare-code-units';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { PlatformAdminStatus } from '../../../generated/control/enums';
import { LoginDto } from '../../auth/dto/login.dto';
import { invalidCredentials, isLocked, LockoutPolicy, recordFailedLogin, RESET_LOCKOUT } from '../../auth/login-lockout';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../auth/password';
import { SessionEngine, SessionPolicy } from '../../auth/session-engine';
import type { PlatformActor } from '../audit/platform-actor';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformSessionStore } from './platform-session.store';
import { PlatformStateService } from './platform-state.service';

// Parallel attempts of one admin wait for each other; each lasts one password hash at most
const BURST_WAIT_MS = 15_000;

const revoked = () => new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.TOKEN_REVOKED, 'Session revoked');

/** Same shape as the tenant modules: read opens the menu entry, manage gives the writes, anything else is specialized. */
function buildPlatformModules(grants: { resource: string; action: string }[]) {
  const resources = [...new Set(grants.map((g) => g.resource))].sort(compareCodeUnits);
  return resources.map((module) => {
    const actions = grants.filter((g) => g.resource === module).map((g) => g.action);
    const manage = actions.includes('manage');
    return {
      module,
      scope: 'PLATFORM',
      visible: actions.includes('read'),
      actions: { read: actions.includes('read'), create: manage, update: manage, delete: manage },
      specialized: actions.filter((a) => a !== 'read' && a !== 'manage'),
    };
  });
}

@Injectable()
export class PlatformAuthService {
  private readonly lockout: LockoutPolicy;
  private readonly sessionPolicy: SessionPolicy;

  constructor(
    private readonly control: ControlPrismaService,
    private readonly tokens: AccessTokenService,
    private readonly state: PlatformStateService,
    private readonly audit: PlatformAuditService,
    config: ConfigService,
  ) {
    this.lockout = {
      maxAttempts: config.getOrThrow<number>('LOGIN_MAX_ATTEMPTS'),
      lockMinutes: config.getOrThrow<number>('LOGIN_LOCK_MINUTES'),
    };
    this.sessionPolicy = {
      idleMs: config.getOrThrow<number>('SESSION_IDLE_MINUTES') * 60_000,
      maxMs: config.getOrThrow<number>('SESSION_MAX_HOURS') * 3_600_000,
      refreshMs: config.getOrThrow<number>('REFRESH_TOKEN_DAYS') * 86_400_000,
      graceMs: config.getOrThrow<number>('REFRESH_REUSE_GRACE_SECONDS') * 1000,
    };
  }

  /** Every refusal is the same 401 and takes the same time, whatever the reason. */
  async login(dto: Pick<LoginDto, 'email' | 'password'>, client: ClientInfo = {}) {
    const email = dto.email.trim().toLowerCase();
    const admin = await this.control.platformAdmin.findUnique({ where: { email } });
    const actor: PlatformActor = { adminId: admin?.id, email, ...client };

    if (!admin || admin.status !== PlatformAdminStatus.ACTIVE || isLocked(admin.lockedUntil)) {
      await burnPasswordCheck(dto.password);
      await this.audit.recordSafe(actor, { action: 'auth.login_failed', targetType: 'platform_admin', targetId: admin?.id });
      throw invalidCredentials();
    }
    if (!(await verifyPassword(admin.passwordHash, dto.password))) {
      await recordFailedLogin(this.control, 'platform_admins', admin.id, this.lockout);
      await this.audit.recordSafe(actor, { action: 'auth.login_failed', targetType: 'platform_admin', targetId: admin.id });
      throw invalidCredentials();
    }

    const { sessionId, refreshToken } = await this.engine().open(admin.id, client);
    await this.control.platformAdmin.update({ where: { id: admin.id }, data: { ...RESET_LOCKOUT, lastLoginAt: new Date() } });
    await this.audit.recordSafe(actor, { action: 'auth.login', targetType: 'platform_session', targetId: sessionId });
    const profile = await this.me(admin.id);
    return {
      accessToken: await this.tokens.signPlatform({ sub: admin.id, ver: admin.tokenVersion, sid: sessionId }),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTtlSeconds,
      mfaRequired: false,
      ...profile,
    };
  }

  async me(adminId: string) {
    const admin = await this.control.platformAdmin.findUniqueOrThrow({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        lastLoginAt: true,
        permissionsVersion: true,
        role: {
          select: {
            id: true,
            key: true,
            name: true,
            permissions: { select: { permission: { select: { resource: true, action: true } } } },
          },
        },
      },
    });
    const grants = admin.role.permissions.map((p) => p.permission);
    return {
      user: { id: admin.id, email: admin.email, fullName: admin.fullName, status: admin.status, lastLoginAt: admin.lastLoginAt },
      context: { type: 'platform' },
      role: { id: admin.role.id, key: admin.role.key, name: admin.role.name },
      roles: [admin.role.key],
      permissions: grants.map((g) => `${g.resource}.${g.action}`).sort(compareCodeUnits),
      permissionsVersion: admin.permissionsVersion,
      modules: buildPlatformModules(grants),
    };
  }

  async refresh(refreshToken: string, client: ClientInfo) {
    const result = await this.engine().rotate(refreshToken, client);
    if (result.kind === 'invalid') throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_TOKEN, 'Invalid or expired token');
    if (result.kind !== 'rotated') {
      await this.state.changed(result.subjectId);
      if (result.kind === 'reused') {
        await this.audit.recordSafe(
          { adminId: result.subjectId, ...client },
          { action: 'auth.refresh_reuse', targetType: 'platform_session', targetId: result.sessionId },
        );
      }
      throw revoked();
    }
    const admin = await this.control.platformAdmin.findUnique({
      where: { id: result.subjectId },
      select: { status: true, tokenVersion: true },
    });
    if (admin?.status !== PlatformAdminStatus.ACTIVE) {
      await this.control.platformSession.updateMany({ where: { id: result.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw revoked();
    }
    return {
      accessToken: await this.tokens.signPlatform({ sub: result.subjectId, ver: admin.tokenVersion, sid: result.sessionId }),
      refreshToken: result.refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTtlSeconds,
    };
  }

  /** Always succeeds (E-SESS-06): an expired access token or an unknown refresh token just has nothing left to revoke. */
  async logout(bearer: string | undefined, refreshToken: string | undefined, client: ClientInfo) {
    const payload = bearer ? await this.tokens.verifyPlatform(bearer, { ignoreExpiration: true }) : null;
    const token = refreshToken
      ? await this.control.platformRefreshToken.findUnique({
          where: { tokenHash: hashOpaqueToken(refreshToken) },
          select: { sessionId: true, session: { select: { adminId: true } } },
        })
      : null;
    const sessionId = payload?.sid ?? token?.sessionId;
    const adminId = payload?.sub ?? token?.session.adminId;
    if (!sessionId || !adminId) return;
    const { count } = await this.control.platformSession.updateMany({
      where: { id: sessionId, adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) return;
    await this.state.changed(adminId);
    await this.audit.recordSafe({ adminId, ...client }, { action: 'auth.logout', targetType: 'platform_session', targetId: sessionId });
  }

  /** The other sessions end; the one that changed the password stays. */
  async changePassword(adminId: string, sessionId: string | undefined, currentPassword: string, newPassword: string, client: ClientInfo) {
    // A stolen session must not be able to guess the password: wrong ones count toward the lock, and a locked account
    // is refused without testing anything. The row lock makes a burst test one guess at a time.
    const check = await this.control.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM platform_admins WHERE id = ${adminId}::uuid FOR UPDATE`;
        const admin = await tx.platformAdmin.findUniqueOrThrow({
          where: { id: adminId },
          select: { passwordHash: true, lockedUntil: true },
        });
        if (isLocked(admin.lockedUntil)) return { outcome: 'refused' as const };
        if (await verifyPassword(admin.passwordHash, currentPassword))
          return { outcome: 'passed' as const, passwordHash: admin.passwordHash };
        await recordFailedLogin(tx, 'platform_admins', adminId, this.lockout);
        return { outcome: 'wrong' as const };
      },
      { maxWait: BURST_WAIT_MS, timeout: BURST_WAIT_MS },
    );
    if (check.outcome === 'wrong') {
      await this.audit.recordSafe(
        { adminId, ...client },
        { action: 'auth.password_check_failed', targetType: 'platform_admin', targetId: adminId },
      );
    }
    if (check.outcome !== 'passed') throw fieldError('current_password', 'invalid', 'Current password is incorrect');
    if (await verifyPassword(check.passwordHash, newPassword)) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.PASSWORD_REUSED, 'New password must differ from the current one');
    }
    const passwordHash = await hashPassword(newPassword);
    await this.control.$transaction(async (tx) => {
      await tx.platformAdmin.update({ where: { id: adminId }, data: { passwordHash } });
      await tx.platformSession.updateMany({ where: { adminId, revokedAt: null, id: { not: sessionId } }, data: { revokedAt: new Date() } });
      await this.audit.record(
        { adminId, ...client },
        { action: 'auth.password_changed', targetType: 'platform_admin', targetId: adminId },
        tx,
      );
    });
    await this.state.changed(adminId);
  }

  private engine() {
    return new SessionEngine(new PlatformSessionStore(this.control, this.control), this.sessionPolicy);
  }
}
