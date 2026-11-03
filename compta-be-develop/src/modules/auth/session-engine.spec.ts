import { hashOpaqueToken } from '../../common/crypto/opaque-token';
import { isSessionLive, SessionEngine, SessionStore, StoredRefreshToken } from './session-engine';

const MIN = 60_000;
const policy = { idleMs: 30 * MIN, maxMs: 12 * 60 * MIN, refreshMs: 7 * 24 * 60 * MIN, graceMs: 10_000 };
const start = new Date('2026-11-02T00:00:00Z');
const at = (minutes: number) => new Date(start.getTime() + minutes * MIN);

class MemoryStore implements SessionStore {
  session = {
    id: 's1',
    subjectId: 'u1',
    userAgent: 'tab' as string | null,
    revokedAt: null as Date | null,
    expiresAt: new Date(0),
    lastUsedAt: start,
  };
  tokens = new Map<string, { id: string; usedAt: Date | null; expiresAt: Date }>();

  createSession(data: Parameters<SessionStore['createSession']>[0]) {
    this.session.expiresAt = data.expiresAt;
    return Promise.resolve(this.session.id);
  }
  addToken({ tokenHash, expiresAt }: Parameters<SessionStore['addToken']>[0]) {
    this.tokens.set(tokenHash, { id: tokenHash, usedAt: null, expiresAt });
    return Promise.resolve();
  }
  findTokenLocked(tokenHash: string): Promise<StoredRefreshToken | null> {
    const token = this.tokens.get(tokenHash);
    return Promise.resolve(token ? { ...token, session: this.session } : null);
  }
  markTokenUsed(id: string, when: Date) {
    const token = this.tokens.get(id)!;
    if (token.usedAt) return Promise.resolve(false);
    token.usedAt = when;
    return Promise.resolve(true);
  }
  touchSession(_: string, when: Date) {
    this.session.lastUsedAt = when;
    return Promise.resolve();
  }
  revokeSession(_: string, when: Date) {
    this.session.revokedAt = when;
    return Promise.resolve();
  }
  inTransaction<T>(fn: (store: SessionStore) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

const open = async (engine: SessionEngine) => (await engine.open('u1', { userAgent: 'tab' }, start)).refreshToken;

describe('SessionEngine', () => {
  let store: MemoryStore;
  let engine: SessionEngine;
  let n: number;

  beforeEach(() => {
    store = new MemoryStore();
    n = 0;
    engine = new SessionEngine(store, policy, () => `token-${++n}`);
  });

  it('E-SESS-05 exactly at 30 minutes of inactivity the session is over; one millisecond before it is alive', () => {
    const session = { revokedAt: null, expiresAt: at(720), lastUsedAt: start };
    expect(isSessionLive(session, new Date(at(30).getTime() - 1), 30 * MIN)).toBe(true);
    expect(isSessionLive(session, at(30), 30 * MIN)).toBe(false);
  });

  it('E-SESS-04 exactly at the 12 hour mark the session is over', () => {
    const session = { revokedAt: null, expiresAt: at(720), lastUsedAt: at(719) };
    expect(isSessionLive(session, new Date(at(720).getTime() - 1), 30 * MIN)).toBe(true);
    expect(isSessionLive(session, at(720), 30 * MIN)).toBe(false);
  });

  it('E-SESS-04 refreshing every 20 minutes never takes it past 12 hours', async () => {
    let token = await open(engine);
    let minute = 0;
    for (;;) {
      minute += 20;
      const result = await engine.rotate(token, { userAgent: 'tab' }, at(minute));
      if (result.kind !== 'rotated') {
        expect(result.kind).toBe('expired');
        break;
      }
      token = result.refreshToken;
    }
    expect(minute).toBe(720);
    expect(store.session.revokedAt).toEqual(at(720));
  });

  it('rotates: the new token works, only hashes are kept', async () => {
    const token = await open(engine);
    expect(store.tokens.has(hashOpaqueToken(token))).toBe(true);
    expect(store.tokens.has(token)).toBe(false);
    const result = await engine.rotate(token, { userAgent: 'tab' }, at(1));
    expect(result).toMatchObject({ kind: 'rotated', subjectId: 'u1', sessionId: 's1' });
  });

  it('E-SESS-01 the same token again within the grace from the same client succeeds', async () => {
    const token = await open(engine);
    await engine.rotate(token, { userAgent: 'tab' }, at(1));
    const again = await engine.rotate(token, { userAgent: 'tab' }, new Date(at(1).getTime() + 5_000));
    expect(again.kind).toBe('rotated');
    expect(store.session.revokedAt).toBeNull();
  });

  it.each([
    ['at the end of the grace', 'tab', 10_000],
    ['past the grace', 'tab', 60_000],
    ['from another client', 'other', 1_000],
  ])('E-SESS-01 reuse %s is theft: the session dies', async (_, userAgent, afterMs) => {
    const token = await open(engine);
    await engine.rotate(token, { userAgent: 'tab' }, at(1));
    const again = await engine.rotate(token, { userAgent }, new Date(at(1).getTime() + afterMs));
    expect(again.kind).toBe('reused');
    expect(store.session.revokedAt).not.toBeNull();
  });

  it('REFRESH_REUSE_GRACE_SECONDS=0 turns the grace off', async () => {
    const strict = new SessionEngine(store, { ...policy, graceMs: 0 }, () => `strict-${++n}`);
    const token = await open(strict);
    await strict.rotate(token, { userAgent: 'tab' }, at(1));
    expect((await strict.rotate(token, { userAgent: 'tab' }, at(1))).kind).toBe('reused');
  });

  it('E-SESS-02 a session revoked meanwhile gives no token', async () => {
    const token = await open(engine);
    store.session.revokedAt = at(1);
    expect((await engine.rotate(token, { userAgent: 'tab' }, at(2))).kind).toBe('expired');
  });

  it('an unknown token is simply invalid', async () => {
    expect((await engine.rotate('nope', {}, at(1))).kind).toBe('invalid');
  });
});
