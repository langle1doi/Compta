import { Injectable, Logger } from '@nestjs/common';
import { sanitizeAudit } from '../../common/audit/sanitize';
import { Prisma } from '../../generated/tenant/client';
import { AccessContext, companyFilter } from '../rbac/access';
import { TenantDbService } from '../tenancy/tenant-db.service';
import type { AuditActor } from './audit.types';
import type { ListAuditLogsQuery } from './dto/list-audit-logs.query';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  companyId?: string | null;
  before?: unknown;
  after?: unknown;
}

const json = (value: unknown) => {
  const clean = sanitizeAudit(value);
  return clean === undefined || clean === null ? undefined : (clean as Prisma.InputJsonValue);
};

/**
 * Tenant audit log (F16). Sensitive operations call `record` with their transaction: the change and its log commit
 * or fail together (E-AUD-01). Other writes go through the interceptor with `recordSafe`: the change is already
 * committed, so a failure there is logged as an error instead of reported to the client.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly tenantDb: TenantDbService) {}

  async record(actor: AuditActor, entry: AuditEntry, tx?: Prisma.TransactionClient) {
    await (tx ?? this.tenantDb.client).auditLog.create({
      data: {
        actorType: actor.type,
        actorEmail: actor.email,
        userId: actor.userId,
        companyId: entry.companyId ?? actor.companyId ?? undefined,
        entity: entry.entity,
        entityId: entry.entityId ?? undefined,
        action: entry.action,
        before: json(entry.before),
        after: json(entry.after),
        ip: actor.ip,
        userAgent: actor.userAgent,
        requestId: actor.requestId,
      },
    });
  }

  async recordSafe(actor: AuditActor, entry: AuditEntry) {
    try {
      await this.record(actor, entry);
    } catch (error) {
      this.logger.error(
        { errorCode: (error as { code?: string }).code, action: entry.action, requestId: actor.requestId },
        'Audit entry could not be written',
      );
    }
  }

  /** GET /audit-logs: a company-level reader only sees rows of the selected company. */
  async list(access: AccessContext, query: ListAuditLogsQuery) {
    const companyId = companyFilter(access);
    const where: Prisma.AuditLogWhereInput = {
      ...(companyId && { companyId }),
      userId: query.actorId,
      entity: query.entityType,
      entityId: query.entityId,
      action: query.action,
      createdAt: { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined },
    };
    const db = this.tenantDb.client;
    const [rows, total] = await Promise.all([
      db.auditLog.findMany({ where, orderBy: { id: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      db.auditLog.count({ where }),
    ]);
    const items = rows.map(({ id, userId, entity, ...row }) => ({ ...row, id: id.toString(), actorId: userId, entityType: entity }));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
