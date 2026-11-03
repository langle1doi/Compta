import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { AccessTokenService } from '../../common/auth/access-token.service';
import { IS_PUBLIC, MFA_SETUP_ALLOWED, PLATFORM_ONLY } from '../../common/auth/auth.decorators';
import type { SupportTokenPayload } from '../../common/auth/auth.types';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { RequestContext } from '../../common/logging/request-context';
import { PlatformStateService } from '../platform/auth/platform-state.service';
import { SupportAccessService } from '../platform/support/support-access.service';
import { currentTenant } from '../tenancy/tenant-context';
import { UserStateService } from './user-state.service';

type AuthenticatedRequest = Request & RequestContext;

const unauthorized = (code: ErrorCode = ErrorCode.UNAUTHORIZED, message = 'Authentication required') =>
  new AppException(HttpStatus.UNAUTHORIZED, code, message);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenService,
    private readonly userState: UserStateService,
    private readonly platformState: PlatformStateService,
    private readonly support: SupportAccessService,
    private readonly logger: PinoLogger,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearer(req);

    if (this.reflector.getAllAndOverride<boolean>(PLATFORM_ONLY, targets)) return this.authenticatePlatform(req, token);

    const tenant = currentTenant();
    const supportPayload = await this.tokens.verifySupport(token);
    if (supportPayload) return this.authenticateSupport(req, supportPayload, tenant);
    return this.authenticateTenant(req, token, tenant, targets);
  }

  private async authenticatePlatform(req: AuthenticatedRequest, token: string) {
    const payload = await this.tokens.verifyPlatform(token);
    if (!payload) throw unauthorized(ErrorCode.UNAUTHORIZED, 'Invalid or expired token');
    if (!(await this.platformState.checkToken(payload))) throw unauthorized(ErrorCode.TOKEN_REVOKED, 'Session revoked');
    req.user = { id: payload.sub, type: 'platform', sessionId: payload.sid };
    this.logger.assign({ userId: payload.sub, platform: true });
    return true;
  }

  private async authenticateSupport(req: AuthenticatedRequest, payload: SupportTokenPayload, tenant: ReturnType<typeof currentTenant>) {
    // E-PLAT-07: bound to the tenant that granted it
    if (tenant?.tenantId !== payload.tid) throw unauthorized(ErrorCode.WRONG_TENANT, 'Token does not belong to this tenant');
    if (!(await this.support.isValid(payload))) throw unauthorized(ErrorCode.SUPPORT_SESSION_INVALID, 'Support session is over');
    req.user = {
      id: payload.sub,
      type: 'support',
      tenantId: payload.tid,
      supportSessionId: payload.ssn,
      email: payload.email,
    };
    this.logger.assign({ userId: payload.sub, support: true });
    return true;
  }

  private async authenticateTenant(
    req: AuthenticatedRequest,
    token: string,
    tenant: ReturnType<typeof currentTenant>,
    targets: Parameters<Reflector['getAllAndOverride']>[1],
  ) {
    const payload = await this.tokens.verifyTenant(token);
    if (!payload) throw unauthorized(ErrorCode.UNAUTHORIZED, 'Invalid or expired token');
    // F02 BR-04: the token's tenant must be the tenant of the subdomain
    if (tenant?.tenantId !== payload.tid) throw unauthorized(ErrorCode.WRONG_TENANT, 'Token does not belong to this tenant');
    // F04 AC-04: disabled users and revoked sessions are rejected on the next request
    const check = await this.userState.checkToken(tenant.tenantId, tenant.db, payload);
    if (!check.valid) throw unauthorized(ErrorCode.TOKEN_REVOKED, 'Session revoked');

    req.user = { id: payload.sub, type: 'tenant', tenantId: payload.tid, sessionId: payload.sid };
    this.logger.assign({ userId: payload.sub });

    // F02 AC-05: until 2FA is on, only the setup steps work
    if (check.mfaSetupRequired && !this.reflector.getAllAndOverride<boolean>(MFA_SETUP_ALLOWED, targets)) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.MFA_SETUP_REQUIRED, 'Set up two-factor authentication first');
    }
    return true;
  }

  /** Exactly "Bearer <one token>"; anything else is no credential at all (E-AUTH-07). */
  private bearer(req: AuthenticatedRequest): string {
    const match = /^Bearer (\S+)$/.exec(req.header('authorization') ?? '');
    if (!match) throw unauthorized();
    return match[1];
  }
}
