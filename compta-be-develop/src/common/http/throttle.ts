import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';
import type { EnvironmentVariables } from '../../config/env.validation';
import type { RequestContext } from '../logging/request-context';

const MINUTE_MS = 60_000;
const IS_LOGIN_ROUTE = 'throttle:login';
const IS_MFA_ROUTE = 'throttle:mfa';
const LIMITS_BY_EMAIL = 'throttle:email';

/**
 * Stricter per-IP rate limit for sensitive anonymous endpoints. Brute force on one account is additionally
 * stopped by the account lockout (F02 AC-03: 5 failures / 15 min).
 */
export const LoginThrottle = () => SetMetadata(IS_LOGIN_ROUTE, true);

/** Also limited per submitted email: an attack spreading over many IPs stays limited. */
export const EmailThrottle = () => SetMetadata(LIMITS_BY_EMAIL, true);

/** F02 G: 2FA codes, 5 per minute per IP. */
export const MfaThrottle = () => SetMetadata(IS_MFA_ROUTE, true);

type AnyRequest = Request & RequestContext & { body?: { email?: unknown; company_code?: unknown; workspace?: { company_code?: unknown } } };

/** Limits are per tenant: traffic on one tenant never uses up the limit of another. */
function tenantKey(req: AnyRequest): string {
  const code = req.body?.workspace?.company_code ?? req.body?.company_code;
  return req.tenant?.id ?? (typeof code === 'string' ? code.toLowerCase() : 'platform');
}

function emailTracker(req: Record<string, unknown>): Promise<string> {
  const anyReq = req as unknown as AnyRequest;
  const email = anyReq.body?.email;
  // Unknown addresses count the same way, so the limit does not reveal which ones exist
  return Promise.resolve(`${tenantKey(anyReq)}|${typeof email === 'string' ? email.trim().toLowerCase() : ''}`);
}

/** Tracks the real client address (see client-info.ts), per tenant. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const anyReq = req as unknown as AnyRequest;
    return Promise.resolve(`${tenantKey(anyReq)}|${anyReq.clientIp ?? anyReq.socket?.remoteAddress ?? 'unknown'}`);
  }
}

export function buildThrottlerOptions(
  env: Pick<EnvironmentVariables, 'THROTTLE_DEFAULT_LIMIT' | 'THROTTLE_LOGIN_LIMIT' | 'THROTTLE_LOGIN_EMAIL_LIMIT' | 'THROTTLE_MFA_LIMIT'>,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: 'default', ttl: MINUTE_MS, limit: env.THROTTLE_DEFAULT_LIMIT },
      {
        name: 'login',
        ttl: MINUTE_MS,
        limit: env.THROTTLE_LOGIN_LIMIT,
        skipIf: (ctx: ExecutionContext) => !Reflect.getMetadata(IS_LOGIN_ROUTE, ctx.getHandler()),
      },
      {
        name: 'login-email',
        ttl: MINUTE_MS,
        limit: env.THROTTLE_LOGIN_EMAIL_LIMIT,
        skipIf: (ctx: ExecutionContext) => !Reflect.getMetadata(LIMITS_BY_EMAIL, ctx.getHandler()),
        getTracker: emailTracker,
      },
      {
        name: 'mfa',
        ttl: MINUTE_MS,
        limit: env.THROTTLE_MFA_LIMIT,
        skipIf: (ctx: ExecutionContext) => !Reflect.getMetadata(IS_MFA_ROUTE, ctx.getHandler()),
      },
    ],
    errorMessage: 'Too many requests, slow down',
  };
}
