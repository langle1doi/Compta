import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { AccessTokenService } from '../../common/auth/access-token.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { RequestContext } from '../../common/logging/request-context';
import { Tenant, TenantStatus } from '../../generated/control/client';
import { RESERVED_SUBDOMAINS } from './reserved-subdomains';
import { tenantStorage } from './tenant-context';
import { TenantRegistryService } from './tenant-registry.service';

/**
 * Resolves the tenant from the Host subdomain (dfm.app.com -> "dfm"); without a subdomain (IP, shared domain) from
 * the signed access token. Never from another header, a query or a body param: X-Forwarded-Host means nothing here.
 * The token's tenant must match the subdomain: JwtAuthGuard checks that (F02 BR-04).
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  private readonly baseDomain: string;

  constructor(
    private readonly registry: TenantRegistryService,
    private readonly tokens: AccessTokenService,
    private readonly logger: PinoLogger,
    config: ConfigService,
  ) {
    this.baseDomain = config.getOrThrow<string>('APP_BASE_DOMAIN').toLowerCase();
  }

  async use(req: Request & RequestContext, _res: Response, next: NextFunction) {
    try {
      const subdomain = this.extractSubdomain(req.headers.host);
      const bearer = /^Bearer (\S+)$/.exec(req.header('authorization') ?? '')?.[1];
      const tenant = subdomain ? await this.registry.findBySubdomain(subdomain) : await this.tenantOfToken(bearer);
      if (!tenant) {
        if (!subdomain) return next();
        throw this.unavailable(bearer);
      }
      if (tenant.status === TenantStatus.SUSPENDED) {
        throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_SUSPENDED, 'Tenant is suspended');
      }
      if (tenant.status !== TenantStatus.ACTIVE) throw this.unavailable(bearer);

      req.tenant = { id: tenant.id, subdomain: tenant.subdomain };
      this.logger.assign({ tenant: tenant.subdomain, tenantId: tenant.id });
      tenantStorage.run(this.registry.contextOf(tenant), () => next());
    } catch (error) {
      next(error);
    }
  }

  /** E-AUTH-06: a token of a tenant that no longer exists is a dead token. */
  private unavailable(bearer: string | undefined) {
    return bearer
      ? new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, 'Invalid or expired token')
      : new AppException(HttpStatus.NOT_FOUND, ErrorCode.TENANT_NOT_FOUND, 'Tenant not found');
  }

  private async tenantOfToken(bearer: string | undefined): Promise<Tenant | null> {
    if (!bearer) return null;
    // An expired token still names its tenant: logout needs that
    const payload =
      (await this.tokens.verifyTenant(bearer, { ignoreExpiration: true })) ??
      (await this.tokens.verifySupport(bearer, { ignoreExpiration: true }));
    if (!payload) return null;
    const tenant = await this.registry.findById(payload.tid);
    if (!tenant) throw this.unavailable(bearer);
    return tenant;
  }

  /** From the Host header itself, whatever Express "trust proxy" says. */
  private extractSubdomain(hostHeader: string | undefined): string | null {
    const host = (hostHeader ?? '').toLowerCase().replace(/:\d+$/, '');
    const suffix = `.${this.baseDomain}`;
    if (!host.endsWith(suffix)) return null;
    const sub = host.slice(0, -suffix.length);
    if (!/^[a-z0-9-]+$/.test(sub) || RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }
}
