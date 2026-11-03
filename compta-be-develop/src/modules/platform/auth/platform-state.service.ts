import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlatformTokenPayload } from '../../../common/auth/auth.types';
import { ControlEventsService } from '../../../database/control-events.service';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { PlatformAdminStatus } from '../../../generated/control/enums';
import { isSessionLive, SessionTimes } from '../../auth/session-engine';

// Upper bound on staleness if a NOTIFY is missed; normally invalidated immediately.
const CACHE_TTL_MS = 30_000;
const TOUCH_EVERY_MS = 60_000;

interface CachedSession extends SessionTimes {
  adminId: string;
  active: boolean;
  tokenVersion: number;
}

/** Per-request check of a platform token: admin ACTIVE, same token version, session alive. */
@Injectable()
export class PlatformStateService {
  private readonly logger = new Logger(PlatformStateService.name);
  private readonly sessions = new Map<string, { session: CachedSession | null; expiresAt: number }>();
  private readonly idleMs: number;

  constructor(
    private readonly control: ControlPrismaService,
    private readonly events: ControlEventsService,
    config: ConfigService,
  ) {
    this.idleMs = config.getOrThrow<number>('SESSION_IDLE_MINUTES') * 60_000;
    events.subscribe((event) => {
      if (event.kind !== 'platform_admin') return;
      for (const [id, entry] of this.sessions) {
        if (!entry.session || entry.session.adminId === event.adminId) this.sessions.delete(id);
      }
    });
  }

  async checkToken(payload: Pick<PlatformTokenPayload, 'sub' | 'ver' | 'sid'>): Promise<boolean> {
    const session = await this.session(payload.sid);
    if (!session || session.adminId !== payload.sub || !session.active || session.tokenVersion !== payload.ver) return false;
    const now = new Date();
    if (!isSessionLive(session, now, this.idleMs)) return false;
    if (now.getTime() - session.lastUsedAt.getTime() > TOUCH_EVERY_MS) this.touch(payload.sid, session, now);
    return true;
  }

  async changed(adminId: string) {
    await this.events.publish({ kind: 'platform_admin', adminId });
  }

  private async session(id: string): Promise<CachedSession | null> {
    const cached = this.sessions.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.session;
    const row = await this.control.platformSession.findUnique({
      where: { id },
      select: {
        adminId: true,
        revokedAt: true,
        expiresAt: true,
        lastUsedAt: true,
        admin: { select: { status: true, tokenVersion: true } },
      },
    });
    const session = row && {
      adminId: row.adminId,
      revokedAt: row.revokedAt,
      expiresAt: row.expiresAt,
      lastUsedAt: row.lastUsedAt,
      active: row.admin.status === PlatformAdminStatus.ACTIVE,
      tokenVersion: row.admin.tokenVersion,
    };
    this.sessions.set(id, { session, expiresAt: Date.now() + CACHE_TTL_MS });
    return session;
  }

  private touch(id: string, session: CachedSession, now: Date) {
    session.lastUsedAt = now;
    this.control.platformSession.update({ where: { id }, data: { lastUsedAt: now } }).catch((error: unknown) => {
      this.logger.warn({ code: (error as { code?: string }).code }, 'Could not record session activity');
    });
  }
}
