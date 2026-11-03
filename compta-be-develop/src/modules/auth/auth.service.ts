import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessTokenService } from '../../common/auth/access-token.service';
import { generateTenantToken, hashOpaqueToken } from '../../common/crypto/opaque-token';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { ClientInfo } from '../../common/http/client-info';
import type { Prisma } from '../../generated/tenant/client';
import { CompanyStatus, UserStatus } from '../../generated/tenant/enums';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { effectiveScope } from '../rbac/casbin/subjects';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { LoginDto } from './dto/login.dto';
import { LoginAttemptsService } from './login-attempts.service';
import { invalidCredentials, isLocked, RESET_LOCKOUT } from './login-lockout';
import { MfaService } from './mfa.service';
import { burnPasswordCheck, verifyPassword } from './password';
import { buildModules, mergeGrants, PermissionView } from './permissions-view';
import { SessionEngine, SessionPolicy } from './session-engine';
import { TenantSessionStore } from './tenant-session.store';
import { UserStateService } from './user-state.service';

const revoked = () => new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.TOKEN_REVOKED, 'Session revoked');

const toActor = (client: ClientInfo, userId?: string, email?: string): AuditActor => ({
  type: userId ? 'user' : null,
  userId,
  email,
  ip: client.ip,
  userAgent: client.userAgent,
});

const MEMBERSHIPS = {
  select: {
    companyId: true,
    company: { select: { id: true, legalName: true, status: true } },
    role: {
      select: {
        id: true,
        key: true,
        name: true,
        permissions: {
          orderBy: [{ permission: { resource: 'asc' } }, { permission: { action: 'asc' } }],
          select: { scope: true, permission: { select: { resource: true, action: true } } },
        },
      },
    },
  },
  orderBy: { createdAt: 'asc' },
} satisfies Prisma.User$membershipsArgs;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly sessionPolicy: SessionPolicy;

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly tokens: AccessTokenService,
    private readonly userState: UserStateService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
    private readonly attempts: LoginAttemptsService,
    config: ConfigService,
  ) {
    this.sessionPolicy = {
      idleMs: config.getOrThrow<number>('SESSION_IDLE_MINUTES') * 60_000,
      maxMs: config.getOrThrow<number>('SESSION_MAX_HOURS') * 3_600_000,
      refreshMs: config.getOrThrow<number>('REFRESH_TOKEN_DAYS') * 86_400_000,
      graceMs: config.getOrThrow<number>('REFRESH_REUSE_GRACE_SECONDS') * 1000,
    };
  }

  /** First login step. Every refusal is the same 401 and takes the same time, whatever the reason. */
  async login(dto: LoginDto, client: ClientInfo) {
    const db = this.tenantDb.client;
    const email = dto.email;
    const user = await db.user.findUnique({ where: { email } });

    if (!user || user.status !== UserStatus.ACTIVE || !user.passwordHash || isLocked(user.lockedUntil)) {
      await burnPasswordCheck(dto.password);
      await this.audit.recordSafe(toActor(client, user?.id, email), { action: 'auth.login_failed', entity: 'user', entityId: user?.id });
      throw invalidCredentials();
    }

    if (!(await verifyPassword(user.passwordHash, dto.password))) {
      await this.attempts.recordLoginFailure(user.id, email, toActor(client, user.id, email));
      throw invalidCredentials();
    }

    if (user.mfaEnabled) {
      // The password alone clears nothing: logging in again must not buy more guesses at the code (E-MFA-04)
      return {
        mfaRequired: true,
        mfaToken: await this.tokens.signMfa({ sub: user.id, tid: this.tenantDb.tenantId, ver: user.tokenVersion }),
        methods: ['totp', 'backup_code'],
      };
    }
    return this.openSession(user.id, client);
  }

  /** Second step: the code counts like a password attempt, so it cannot be guessed either (E-MFA-04). */
  async verifyMfa(mfaToken: string, code: string, client: ClientInfo) {
    const payload = await this.tokens.verifyMfa(mfaToken);
    const failed = () => new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.MFA_INVALID_CODE, 'Invalid code');
    // E-MFA-03: bound to its tenant
    if (!payload || payload.tid !== this.tenantDb.tenantId) throw failed();

    const attempt = await this.attempts.attempt(
      payload.sub,
      toActor(client, payload.sub),
      'auth.login_failed',
      async (tx, user) => {
        const method = await this.mfa.verifyCode(user.id, code, tx);
        if (method) await tx.user.update({ where: { id: user.id }, data: RESET_LOCKOUT });
        return method;
      },
      (user) => user.status === UserStatus.ACTIVE && user.tokenVersion === payload.ver && user.mfaEnabled,
    );
    if (attempt.outcome !== 'passed') throw failed();
    return this.openSession(payload.sub, client, { mfaMethod: attempt.value });
  }

  async refresh(refreshToken: string, client: ClientInfo) {
    const result = await this.engine().rotate(refreshToken, client);
    if (result.kind === 'invalid') throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_TOKEN, 'Invalid or expired token');
    if (result.kind !== 'rotated') {
      await this.userState.sessionRevoked(this.tenantDb.tenantId, result.sessionId);
      if (result.kind === 'reused') {
        await this.audit.recordSafe(toActor(client, result.subjectId), {
          action: 'auth.refresh_reuse',
          entity: 'session',
          entityId: result.sessionId,
        });
      }
      throw revoked();
    }

    const db = this.tenantDb.client;
    const user = await db.user.findUnique({
      where: { id: result.subjectId },
      select: { status: true, tokenVersion: true, permissionsVersion: true },
    });
    if (user?.status !== UserStatus.ACTIVE) {
      await this.revokeSession(result.sessionId);
      throw revoked();
    }
    return {
      accessToken: await this.tokens.signTenant({
        sub: result.subjectId,
        tid: this.tenantDb.tenantId,
        ver: user.tokenVersion,
        sid: result.sessionId,
      }),
      refreshToken: result.refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTtlSeconds,
      mfaSetupRequired: await this.userState.mfaSetupRequired(db, result.subjectId),
      permissionsVersion: user.permissionsVersion,
    };
  }

  /** Always succeeds (E-SESS-06): whatever could be revoked is revoked. */
  async logout(sessionId: string | undefined, refreshToken: string | undefined, actor: AuditActor) {
    const db = this.tenantDb.client;
    const fromToken = refreshToken
      ? await db.refreshToken.findUnique({ where: { tokenHash: hashOpaqueToken(refreshToken) }, select: { sessionId: true } })
      : null;
    const target = sessionId ?? fromToken?.sessionId;
    if (!target) return;
    const session = await db.session.findUnique({ where: { id: target }, select: { revokedAt: true, userId: true } });
    if (!session || session.revokedAt) return;
    await this.revokeSession(target);
    await this.audit.recordSafe(
      { ...actor, type: 'user', userId: session.userId },
      { action: 'auth.logout', entity: 'session', entityId: target },
    );
  }

  async revokeSession(sessionId: string) {
    await this.tenantDb.client.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.userState.sessionRevoked(this.tenantDb.tenantId, sessionId);
  }

  /** Revokes the user's sessions, optionally keeping one. Call with `tx` from inside a sensitive transaction. */
  async revokeUserSessions(userId: string, except?: string) {
    const db = this.tenantDb.client;
    const sessions = await db.session.findMany({
      where: { userId, revokedAt: null, id: except ? { not: except } : undefined },
      select: { id: true },
    });
    await db.session.updateMany({ where: { id: { in: sessions.map((s) => s.id) } }, data: { revokedAt: new Date() } });
    for (const { id } of sessions) await this.userState.sessionRevoked(this.tenantDb.tenantId, id);
  }

  listSessions(userId: string, currentSessionId: string | undefined) {
    return this.tenantDb.client.session
      .findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastUsedAt: 'desc' },
        select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
      })
      .then((rows) => rows.map((row) => ({ ...row, current: row.id === currentSessionId })));
  }

  /** Someone else's session id behaves as an unknown id: nothing to learn from the answer. */
  async deleteSession(userId: string, sessionId: string) {
    const session = await this.tenantDb.client.session.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
    if (!session) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Session not found');
    await this.revokeSession(sessionId);
  }

  /** Tokens and everything the UI needs to start. */
  async openSession(userId: string, client: ClientInfo, details: { mfaMethod?: string } = {}) {
    const db = this.tenantDb.client;
    const tenantId = this.tenantDb.tenantId;
    const { sessionId, refreshToken } = await this.engine().open(userId, client);
    const user = await db.user.update({
      where: { id: userId },
      data: { ...RESET_LOCKOUT, lastLoginAt: new Date() },
      select: { tokenVersion: true },
    });
    const accessToken = await this.tokens.signTenant({ sub: userId, tid: tenantId, ver: user.tokenVersion, sid: sessionId });
    await this.audit.recordSafe(toActor(client, userId), { action: 'auth.login', entity: 'session', entityId: sessionId, after: details });
    const profile = await this.profile(userId);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTtlSeconds,
      mfaRequired: false,
      mfaSetupRequired: await this.userState.mfaSetupRequired(db, userId),
      user: profile.user,
      context: { type: 'tenant', tenantId, companyCode: this.tenantDb.context.subdomain, defaultCompanyId: profile.defaultCompanyId },
      roles: profile.roles,
      permissions: profile.permissions,
      permissionsVersion: profile.permissionsVersion,
      modules: profile.modules,
    };
  }

  /** Profile + permissions per membership, for the UI to show/hide components. Casbin remains the only enforcement. */
  async me(userId: string) {
    const { memberships, ...user } = await this.tenantDb.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        emailSignature: true,
        locale: true,
        status: true,
        mfaEnabled: true,
        lastCompanyId: true,
        permissionsVersion: true,
        memberships: MEMBERSHIPS,
      },
    });

    return {
      ...user,
      memberships: memberships.map(({ company, role: { permissions, ...role } }) => ({
        company,
        role,
        permissions: permissions.map(({ scope, permission }) => ({
          resource: permission.resource,
          action: permission.action,
          scope: effectiveScope(scope, company?.id ?? null),
        })),
      })),
    };
  }

  /** Permissions in one company (the selected one, else the default): tenant-wide memberships apply everywhere. */
  async permissions(userId: string, companyId: string | null) {
    const profile = await this.profile(userId, companyId);
    return {
      companyId: profile.selectedCompanyId,
      permissions: profile.permissions,
      permissionsVersion: profile.permissionsVersion,
      modules: profile.modules,
    };
  }

  private async profile(userId: string, requestedCompanyId: string | null = null) {
    const db = this.tenantDb.client;
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        locale: true,
        status: true,
        mfaEnabled: true,
        lastCompanyId: true,
        permissionsVersion: true,
        memberships: MEMBERSHIPS,
      },
    });
    const { memberships, permissionsVersion, lastCompanyId, ...publicUser } = user;
    const defaultCompanyId = await this.pickCompany(memberships, lastCompanyId);
    const selectedCompanyId = requestedCompanyId ?? defaultCompanyId;
    const applicable = memberships.filter((m) => m.companyId === null || m.companyId === selectedCompanyId);
    const permissions: PermissionView[] = mergeGrants(
      applicable.flatMap((m) =>
        m.role.permissions.map((p) => ({
          resource: p.permission.resource,
          action: p.permission.action,
          scope: effectiveScope(p.scope, m.companyId),
        })),
      ),
    );
    return {
      user: publicUser,
      defaultCompanyId,
      selectedCompanyId,
      roles: [...new Set(memberships.map((m) => m.role.key))],
      permissions,
      permissionsVersion,
      modules: buildModules(permissions, PERMISSIONS),
    };
  }

  /** F02 AC-01: the last company the user worked in, else the tenant's default, else the first one they can access. */
  private async pickCompany(memberships: { companyId: string | null }[], lastCompanyId: string | null): Promise<string | null> {
    const tenantWide = memberships.some((m) => m.companyId === null);
    const accessible = await this.tenantDb.client.company.findMany({
      where: { status: CompanyStatus.ACTIVE, ...(tenantWide ? {} : { id: { in: memberships.map((m) => m.companyId!) } }) },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const ids = accessible.map((c) => c.id);
    const { defaultCompanyId } = this.tenantDb.context;
    if (lastCompanyId && ids.includes(lastCompanyId)) return lastCompanyId;
    if (defaultCompanyId && ids.includes(defaultCompanyId)) return defaultCompanyId;
    return ids[0] ?? null;
  }

  private engine() {
    return new SessionEngine(new TenantSessionStore(this.tenantDb.client, this.tenantDb.client), this.sessionPolicy, () =>
      generateTenantToken(this.tenantDb.tenantId),
    );
  }
}
