import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { from, mergeMap, Observable } from 'rxjs';
import { clientInfoOf } from '../../../common/http/client-info';
import type { RequestContext } from '../../../common/logging/request-context';
import { PlatformAuditService } from '../audit/platform-audit.service';

/** F01 BR-05, platform side of "audit on both sides": the tenant side is written by AuditInterceptor. */
@Injectable()
export class SupportAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: PlatformAuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & RequestContext>();
    const user = req.user;
    if (user?.type !== 'support') return next.handle();
    return next.handle().pipe(
      mergeMap((result: unknown) =>
        from(
          this.audit
            .recordSafe(
              { adminId: user.id, email: user.email, ...clientInfoOf(req) },
              {
                action: 'support.request',
                targetType: 'tenant',
                targetId: user.tenantId,
                after: { sessionId: user.supportSessionId, method: req.method, route: (req.route as { path?: string } | undefined)?.path },
              },
            )
            .then(() => result),
        ),
      ),
    );
  }
}
