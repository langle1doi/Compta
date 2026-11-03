import { generateOpaqueToken, hashOpaqueToken } from '../../common/crypto/opaque-token';
import type { ClientInfo } from '../../common/http/client-info';

export interface SessionPolicy {
  idleMs: number;
  maxMs: number;
  refreshMs: number;
  graceMs: number;
}

export interface SessionTimes {
  revokedAt: Date | null;
  expiresAt: Date;
  lastUsedAt: Date;
}

/** F02 AC-07. Both limits are exclusive: at exactly 30 minutes of inactivity the session is over. */
export function isSessionLive(session: SessionTimes, now: Date, idleMs: number): boolean {
  return !session.revokedAt && now < session.expiresAt && now.getTime() - session.lastUsedAt.getTime() < idleMs;
}

export interface StoredRefreshToken {
  id: string;
  usedAt: Date | null;
  expiresAt: Date;
  session: SessionTimes & { id: string; subjectId: string; userAgent: string | null };
}

/** The tables differ between tenant users and platform admins; the rules do not. */
export interface SessionStore {
  createSession(data: { subjectId: string; client: ClientInfo; expiresAt: Date }): Promise<string>;
  addToken(data: { sessionId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  /** Reads the token and locks its session row until the end of the transaction. */
  findTokenLocked(tokenHash: string): Promise<StoredRefreshToken | null>;
  /** false when another request used it first. */
  markTokenUsed(id: string, at: Date): Promise<boolean>;
  touchSession(id: string, at: Date): Promise<void>;
  revokeSession(id: string, at: Date): Promise<void>;
  inTransaction<T>(fn: (store: SessionStore) => Promise<T>): Promise<T>;
}

export type RotateResult =
  | { kind: 'rotated'; refreshToken: string; sessionId: string; subjectId: string }
  | { kind: 'invalid' }
  | { kind: 'expired'; sessionId: string; subjectId: string }
  | { kind: 'reused'; sessionId: string; subjectId: string };

export class SessionEngine {
  constructor(
    private readonly store: SessionStore,
    private readonly policy: SessionPolicy,
    private readonly newToken: () => string = generateOpaqueToken,
  ) {}

  async open(subjectId: string, client: ClientInfo, now = new Date()) {
    return this.store.inTransaction(async (store) => {
      const sessionId = await store.createSession({ subjectId, client, expiresAt: new Date(now.getTime() + this.policy.maxMs) });
      const refreshToken = await this.issue(store, sessionId, now);
      return { sessionId, refreshToken };
    });
  }

  /**
   * Rotation. The session row stays locked meanwhile, so a concurrent "revoke everything" (password change, disable)
   * either happens first and this refuses, or happens after and kills the session the new token belongs to.
   */
  rotate(refreshToken: string, client: ClientInfo, now = new Date()): Promise<RotateResult> {
    return this.store.inTransaction(async (store): Promise<RotateResult> => {
      const token = await store.findTokenLocked(hashOpaqueToken(refreshToken));
      if (!token) return { kind: 'invalid' };
      const { session } = token;
      const ids = { sessionId: session.id, subjectId: session.subjectId };

      if (token.usedAt) {
        // E-SESS-01: two tabs refreshing at once are the same client within seconds; anything else is a stolen token
        const racing =
          this.policy.graceMs > 0 &&
          now.getTime() - token.usedAt.getTime() < this.policy.graceMs &&
          (session.userAgent ?? '') === (client.userAgent ?? '') &&
          isSessionLive(session, now, this.policy.idleMs);
        if (!racing) {
          if (!session.revokedAt) await store.revokeSession(session.id, now);
          return { kind: 'reused', ...ids };
        }
      } else if (!isSessionLive(session, now, this.policy.idleMs) || now >= token.expiresAt) {
        if (!session.revokedAt) await store.revokeSession(session.id, now);
        return { kind: 'expired', ...ids };
      } else if (!(await store.markTokenUsed(token.id, now))) {
        return { kind: 'invalid' };
      }

      await store.touchSession(session.id, now);
      return { kind: 'rotated', refreshToken: await this.issue(store, session.id, now), ...ids };
    });
  }

  private async issue(store: SessionStore, sessionId: string, now: Date) {
    const refreshToken = this.newToken();
    await store.addToken({
      sessionId,
      tokenHash: hashOpaqueToken(refreshToken),
      expiresAt: new Date(now.getTime() + this.policy.refreshMs),
    });
    return refreshToken;
  }
}
