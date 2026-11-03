import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { clientInfoOf } from '../../common/http/client-info';
import type { RequestContext } from '../../common/logging/request-context';

/** Who did it. type null = nobody authenticated (failed login, public link), `system` = job or CLI. */
export interface AuditActor {
  type: 'user' | 'support' | 'platform' | 'system' | null;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  companyId?: string | null;
}

export const SYSTEM_ACTOR: AuditActor = { type: 'system' };

export function actorOf(req: Request & RequestContext & { id?: unknown }): AuditActor {
  const { ip, userAgent } = clientInfoOf(req);
  const user = req.user;
  const type = user?.type === 'tenant' ? 'user' : (user?.type ?? null);
  return {
    type,
    userId: user?.id,
    email: user?.email,
    ip,
    userAgent,
    requestId: typeof req.id === 'string' ? req.id : undefined,
    companyId: req.access?.companyId ?? null,
  };
}

export const Actor = createParamDecorator((_: unknown, ctx: ExecutionContext): AuditActor => actorOf(ctx.switchToHttp().getRequest()));

export const AUDIT_META = 'audit:meta';
export const NO_AUDIT = 'audit:none';

export interface AuditMeta {
  entity: string;
  /** Prisma model read before and after the handler, for the before/after of the row. */
  model?: string;
  idParam?: string;
  action?: string;
}

/** What a mutating route changes. Mutating routes without it are still recorded, without before/after. */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_META, meta);

/** The service records this itself, inside its own transaction (sensitive operations) or as an auth event. */
export const NoAudit = () => SetMetadata(NO_AUDIT, true);
