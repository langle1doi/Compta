import { Injectable, Logger } from '@nestjs/common';
import { sanitizeAudit } from '../../../common/audit/sanitize';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import type { Prisma } from '../../../generated/control/client';
import type { ListPlatformAuditLogsQuery } from './dto/list-platform-audit-logs.query';
import type { PlatformActor } from './platform-actor';

export interface PlatformAuditEntry {
  action: string;
  targetType?: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
}

const json = (value: unknown) => {
  const clean = sanitizeAudit(value);
  return clean === undefined || clean === null ? undefined : (clean as Prisma.InputJsonValue);
};

/**
 * platform_audit_logs: every change made on the platform and every login. Changes call `record` inside their transaction,
 * so the change and its log commit or fail together; `recordSafe` is for events with nothing to roll back.
 */
@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(private readonly control: ControlPrismaService) {}

  async record(actor: PlatformActor, entry: PlatformAuditEntry, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.control;
    const email =
      actor.email ??
      (actor.adminId && (await db.platformAdmin.findUnique({ where: { id: actor.adminId }, select: { email: true } }))?.email);
    await db.platformAuditLog.create({
      data: {
        actorId: actor.adminId,
        actorEmail: email || undefined,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? undefined,
        before: json(entry.before),
        after: json(entry.after),
        ip: actor.ip,
        userAgent: actor.userAgent,
      },
    });
  }

  async recordSafe(actor: PlatformActor, entry: PlatformAuditEntry) {
    try {
      await this.record(actor, entry);
    } catch (error) {
      this.logger.error({ code: (error as { code?: string }).code, action: entry.action }, 'Platform audit entry could not be written');
    }
  }

  async list(query: ListPlatformAuditLogsQuery) {
    const where: Prisma.PlatformAuditLogWhereInput = {
      action: query.action,
      actorId: query.actorId,
      actorEmail: query.actorEmail?.toLowerCase(),
      targetType: query.targetType,
      targetId: query.targetId,
      createdAt: { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined },
    };
    const [rows, total] = await Promise.all([
      this.control.platformAuditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.control.platformAuditLog.count({ where }),
    ]);
    return { items: rows.map((row) => ({ ...row, id: row.id.toString() })), total, page: query.page, pageSize: query.pageSize };
  }
}
