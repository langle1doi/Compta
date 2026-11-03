import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ControlEventsService } from '../../database/control-events.service';
import type { TenantPrismaClient } from '../../database/tenant-prisma.manager';
import { UserStatus } from '../../generated/tenant/enums';
import { isSessionLive, SessionTimes } from './session-engine';

// Upper bound on staleness if a NOTIFY is missed; normally invalidated immediately.
const CACHE_TTL_MS = 30_000;
const TOUCH_EVERY_MS = 60_000;

/** F02 BR-03 */
export const ROLES_REQUIRING_MFA = ['tenant_admin', 'owner', 'accountant'];

interface UserState {
  status: UserStatus;
  tokenVersion: number;
  mfaSetupRequired: boolean;
}

export type TokenCheck = { valid: false } | { valid: true; mfaSetupRequired: boolean };

/**
 * Per-request check that a token's user is still ACTIVE, its session alive and the token not revoked (F04 AC-04),
 * without hitting the DB on every request. Also where "must set up 2FA first" is decided, so that a role change
 * applies at the next request and not at the next login (E-MFA-08).
 */
@Injectable()
export class UserStateService {
  private readonly logger = new Logger(UserStateService.name);
  private readonly users = new Map<string, { state: UserState | null; expiresAt: number }>();
  private readonly sessions = new Map<string, { session: SessionTimes | null; expiresAt: number }>();
  private readonly mfaEnforced: boolean;
  private readonly idleMs: number;

  constructor(
    private readonly events: ControlEventsService,
    config: ConfigService,
  ) {
    this.mfaEnforced = config.getOrThrow<boolean>('MFA_ENFORCED');
    this.idleMs = config.getOrThrow<number>('SESSION_IDLE_MINUTES') * 60_000;
    events.subscribe((event) => {
      if (event.kind === 'user') this.users.delete(key(event.tenantId, event.userId));
      if (event.kind === 'session') this.sessions.delete(key(event.tenantId, event.sessionId));
      // Role grants changed for an unknown set of users
      if (event.kind === 'policy') this.users.clear();
    });
  }

  async checkToken(tenantId: string, db: TenantPrismaClient, payload: { sub: string; ver: number; sid: string }): Promise<TokenCheck> {
    const state = await this.user(tenantId, db, payload.sub);
    if (state?.status !== UserStatus.ACTIVE || state.tokenVersion !== payload.ver) return { valid: false };
    const session = await this.session(tenantId, db, payload.sid);
    if (!session || !isSessionLive(session, new Date(), this.idleMs)) return { valid: false };
    this.touch(tenantId, db, payload.sid, session);
    return { valid: true, mfaSetupRequired: state.mfaSetupRequired };
  }

  /** Call after changing a user's status, token version or roles. */
  async changed(tenantId: string, userId: string) {
    await this.events.publish({ kind: 'user', tenantId, userId });
  }

  async sessionRevoked(tenantId: string, sessionId: string) {
    await this.events.publish({ kind: 'session', tenantId, sessionId });
  }

  async mfaSetupRequired(db: TenantPrismaClient, userId: string): Promise<boolean> {
    if (!this.mfaEnforced) return false;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, memberships: { select: { role: { select: { key: true } } } } },
    });
    return !!user && this.requiresSetup(db, user);
  }

  private async requiresSetup(db: TenantPrismaClient, user: { mfaEnabled: boolean; memberships: { role: { key: string } }[] }) {
    return !user.mfaEnabled && this.wouldRequireMfa(db, user);
  }

  /** Does this user's role, or the tenant's setting, make 2FA mandatory? (F02 BR-03) */
  async wouldRequireMfa(db: TenantPrismaClient, user: { memberships: { role: { key: string } }[] }) {
    if (!this.mfaEnforced) return false;
    if (user.memberships.some((m) => ROLES_REQUIRING_MFA.includes(m.role.key))) return true;
    const settings = await db.tenantSetting.findUnique({ where: { id: 1 }, select: { mfaRequiredForAll: true } });
    return settings?.mfaRequiredForAll === true;
  }

  private async user(tenantId: string, db: TenantPrismaClient, userId: string): Promise<UserState | null> {
    const k = key(tenantId, userId);
    const cached = this.users.get(k);
    if (cached && cached.expiresAt > Date.now()) return cached.state;
    const row = await db.user.findUnique({
      where: { id: userId },
      select: { status: true, tokenVersion: true, mfaEnabled: true, memberships: { select: { role: { select: { key: true } } } } },
    });
    const state = row && { status: row.status, tokenVersion: row.tokenVersion, mfaSetupRequired: await this.requiresSetup(db, row) };
    this.users.set(k, { state, expiresAt: Date.now() + CACHE_TTL_MS });
    return state;
  }

  private async session(tenantId: string, db: TenantPrismaClient, sessionId: string): Promise<SessionTimes | null> {
    const k = key(tenantId, sessionId);
    const cached = this.sessions.get(k);
    if (cached && cached.expiresAt > Date.now()) return cached.session;
    const session = await db.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true, lastUsedAt: true },
    });
    this.sessions.set(k, { session, expiresAt: Date.now() + CACHE_TTL_MS });
    return session;
  }

  /** Activity keeps the session open (AC-07); once a minute is precise enough and spares a write per request. */
  private touch(tenantId: string, db: TenantPrismaClient, sessionId: string, session: SessionTimes) {
    const now = new Date();
    if (now.getTime() - session.lastUsedAt.getTime() < TOUCH_EVERY_MS) return;
    session.lastUsedAt = now;
    db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { lastUsedAt: now } }).catch((error: { code?: string }) => {
      this.logger.warn({ errorCode: error.code, tenantId }, 'Could not record session activity');
    });
  }
}

const key = (tenantId: string, id: string) => `${tenantId}:${id}`;
