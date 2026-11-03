import type { TenantPrismaClient } from '../../database/tenant-prisma.manager';
import type { Prisma } from '../../generated/tenant/client';
import type { SessionStore, StoredRefreshToken } from './session-engine';

type Db = Prisma.TransactionClient;

export class TenantSessionStore implements SessionStore {
  constructor(
    private readonly db: Db,
    private readonly client?: TenantPrismaClient,
  ) {}

  async createSession({ subjectId, client, expiresAt }: Parameters<SessionStore['createSession']>[0]) {
    const session = await this.db.session.create({ data: { userId: subjectId, ip: client.ip, userAgent: client.userAgent, expiresAt } });
    return session.id;
  }

  async addToken(data: Parameters<SessionStore['addToken']>[0]) {
    await this.db.refreshToken.create({ data });
  }

  async findTokenLocked(tokenHash: string): Promise<StoredRefreshToken | null> {
    const found = await this.db.refreshToken.findUnique({ where: { tokenHash }, select: { sessionId: true } });
    if (!found) return null;
    await this.db.$queryRaw`SELECT id FROM sessions WHERE id = ${found.sessionId}::uuid FOR UPDATE`;
    // Read after the lock: a request that held it may have just used this token (E-SESS-01)
    const token = await this.db.refreshToken.findUniqueOrThrow({ where: { tokenHash } });
    const session = await this.db.session.findUniqueOrThrow({ where: { id: token.sessionId } });
    return { id: token.id, usedAt: token.usedAt, expiresAt: token.expiresAt, session: { ...session, subjectId: session.userId } };
  }

  async markTokenUsed(id: string, at: Date) {
    return (await this.db.refreshToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: at } })).count === 1;
  }

  async touchSession(id: string, at: Date) {
    await this.db.session.update({ where: { id }, data: { lastUsedAt: at } });
  }

  async revokeSession(id: string, at: Date) {
    await this.db.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: at } });
  }

  inTransaction<T>(fn: (store: SessionStore) => Promise<T>): Promise<T> {
    if (!this.client) return fn(this);
    return this.client.$transaction((tx) => fn(new TenantSessionStore(tx)));
  }
}
