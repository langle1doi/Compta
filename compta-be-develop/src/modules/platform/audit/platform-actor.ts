import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ClientInfo, clientInfoOf } from '../../../common/http/client-info';
import type { RequestContext } from '../../../common/logging/request-context';

/** Who did it, for platform_audit_logs. No admin id: a system job or a login that failed. */
export interface PlatformActor extends ClientInfo {
  adminId?: string;
  email?: string;
}

export const SYSTEM_ACTOR: PlatformActor = { email: 'system' };

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): PlatformActor => {
  const req = ctx.switchToHttp().getRequest<Request & RequestContext>();
  return { adminId: req.user?.id, ...clientInfoOf(req) };
});
