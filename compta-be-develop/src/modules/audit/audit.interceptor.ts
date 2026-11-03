import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { from, mergeMap, Observable } from 'rxjs';
import { PLATFORM_ONLY } from '../../common/auth/auth.decorators';
import type { RequestContext } from '../../common/logging/request-context';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { currentTenant } from '../tenancy/tenant-context';
import { AuditService } from './audit.service';
import { actorOf, AUDIT_META, AuditMeta, NO_AUDIT } from './audit.types';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ACTION_BY_METHOD: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

type Delegate = { findUnique(args: { where: { id: string } }): Promise<unknown> };

/**
 * Records every successful write. Rule (E-AUD-04): a request that fails changed nothing and leaves no row here;
 * failed logins and token reuse are recorded by the auth services as their own events.
 * Reads are recorded only for support sessions (F01 BR-05: everything a platform admin does in a tenant).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    private readonly tenantDb: TenantDbService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest<Request & RequestContext>();
    const mutating = MUTATING.has(req.method);
    const support = req.user?.type === 'support';
    if (!req.route || this.reflector.getAllAndOverride<boolean>(NO_AUDIT, targets)) return next.handle();
    if (!mutating && !support) return next.handle();

    if (this.reflector.getAllAndOverride<boolean>(PLATFORM_ONLY, targets)) return next.handle();
    if (!currentTenant()) return next.handle();
    return from(this.forTenant(ctx, req, next)).pipe(mergeMap((result) => result));
  }

  private async forTenant(ctx: ExecutionContext, req: Request & RequestContext, next: CallHandler) {
    const meta = this.reflector.getAllAndOverride<AuditMeta>(AUDIT_META, [ctx.getHandler(), ctx.getClass()]);
    const id = meta?.idParam === undefined ? req.params?.id : req.params?.[meta.idParam];
    const load = (key: string | undefined) => this.load(meta?.model, typeof key === 'string' ? key : undefined);
    const before = await load(typeof id === 'string' ? id : undefined);
    const entity =
      meta?.entity ??
      ctx
        .getClass()
        .name.replace(/Controller$/, '')
        .toLowerCase();

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        const entityId = (typeof id === 'string' ? id : undefined) ?? (result as { id?: string } | undefined)?.id ?? null;
        const after = (await load(entityId ?? undefined)) ?? (MUTATING.has(req.method) ? result : undefined);
        const row = (after ?? before) as { companyId?: string } | undefined;
        const actor = actorOf(req);
        const action = `${entity}.${meta?.action ?? (MUTATING.has(req.method) ? ACTION_BY_METHOD[req.method] : 'read')}`;
        await this.audit.recordSafe(actor, {
          action,
          entity,
          entityId,
          companyId: row?.companyId,
          before,
          after: MUTATING.has(req.method) ? after : undefined,
        });
        return result;
      }),
    );
  }

  private async load(model: string | undefined, id: string | undefined) {
    if (!model || !id) return undefined;
    const delegate = (this.tenantDb.client as unknown as Record<string, Delegate>)[model];
    return (await delegate.findUnique({ where: { id } })) ?? undefined;
  }
}
