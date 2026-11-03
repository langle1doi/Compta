import type { ControlPrismaService } from '../../../database/control-prisma.service';
import type { Prisma } from '../../../generated/control/client';
import type { SessionStore, StoredRefreshToken } from '../../auth/session-engine';

export class PlatformSessionStore implements SessionStore {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly client?: ControlPrismaService,
  ) {}

  async createSession({ subjectId, client, expiresAt }: Parameters<SessionStore['createSession']>[0]) {
    const session = await this.db.platformSession.create({
      data: { adminId: subjectId, ip: client.ip, userAgent: client.userAgent, expiresAt },
    });
    return session.id;
  }

  async addToken(data: Parameters<SessionStore['addToken']>[0]) {
    await this.db.platformRefreshToken.create({ data });
  }

  async findTokenLocked(tokenHash: string): Promise<StoredRefreshToken | null> {
    const token = await this.db.platformRefreshToken.findUnique({ where: { tokenHash } });
    if (!token) return null;
    await this.db.$queryRaw`SELECT id FROM platform_sessions WHERE id = ${token.sessionId}::uuid FOR UPDATE`;
    const session = await this.db.platformSession.findUniqueOrThrow({ where: { id: token.sessionId } });
    return { id: token.id, usedAt: token.usedAt, expiresAt: token.expiresAt, session: { ...session, subjectId: session.adminId } };
  }

  async markTokenUsed(id: string, at: Date) {
    return (await this.db.platformRefreshToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: at } })).count === 1;
  }

  async touchSession(id: string, at: Date) {
    await this.db.platformSession.update({ where: { id }, data: { lastUsedAt: at } });
  }

  async revokeSession(id: string, at: Date) {
    await this.db.platformSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: at } });
  }

  inTransaction<T>(fn: (store: SessionStore) => Promise<T>): Promise<T> {
    if (!this.client) return fn(this);
    return this.client.$transaction((tx) => fn(new PlatformSessionStore(tx)));
  }
}
