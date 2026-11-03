import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import type { MfaTokenPayload, PlatformTokenPayload, SupportTokenPayload, TenantTokenPayload } from './auth.types';

// E-AUTH-08: small tolerance for clock differences between pods
const CLOCK_TOLERANCE_SECONDS = 30;
const MFA_TOKEN_TTL = '5m';

const TENANT_ISSUER = 'compta-tenant';
const PLATFORM_ISSUER = 'compta-platform';

function signer(secret: string, issuer: string, audience: string, expiresIn: string) {
  return new JwtService({
    secret,
    signOptions: { algorithm: 'HS256', issuer, audience, expiresIn: expiresIn as StringValue },
    verifyOptions: { algorithms: ['HS256'], issuer, audience, clockTolerance: CLOCK_TOLERANCE_SECONDS },
  });
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/**
 * Every token kind has its own issuer/audience, and platform tokens their own secret: a token of one kind is
 * rejected by the verifier of any other. Verifiers return null instead of throwing, also on missing claims.
 */
@Injectable()
export class AccessTokenService {
  private readonly tenant: JwtService;
  private readonly support: JwtService;
  private readonly mfa: JwtService;
  private readonly platform: JwtService;
  readonly accessTtlSeconds = 15 * 60;

  constructor(config: ConfigService) {
    const expiresIn = config.getOrThrow<string>('JWT_EXPIRES_IN');
    const secret = config.getOrThrow<string>('JWT_SECRET');
    this.tenant = signer(secret, TENANT_ISSUER, 'compta-tenant-api', expiresIn);
    this.support = signer(secret, TENANT_ISSUER, 'compta-tenant-support', expiresIn);
    this.mfa = signer(secret, TENANT_ISSUER, 'compta-tenant-mfa', MFA_TOKEN_TTL);
    this.platform = signer(config.getOrThrow<string>('PLATFORM_JWT_SECRET'), PLATFORM_ISSUER, 'compta-platform-api', expiresIn);
  }

  signTenant(payload: Omit<TenantTokenPayload, 'typ'>) {
    return this.tenant.signAsync({ ...payload, typ: 'tenant' });
  }

  signPlatform(payload: Omit<PlatformTokenPayload, 'typ'>) {
    return this.platform.signAsync({ ...payload, typ: 'platform' });
  }

  /** Lives as long as its support session: every request checks the session, so a revocation applies at once all the same. */
  signSupport(payload: Omit<SupportTokenPayload, 'typ'>, expiresInSeconds: number) {
    return this.support.signAsync({ ...payload, typ: 'support' }, { expiresIn: expiresInSeconds });
  }

  signMfa(payload: Omit<MfaTokenPayload, 'typ'>) {
    return this.mfa.signAsync({ ...payload, typ: 'mfa' });
  }

  async verifyTenant(token: string, options: { ignoreExpiration?: boolean } = {}): Promise<TenantTokenPayload | null> {
    const p = await this.check<TenantTokenPayload>(this.tenant, token, options.ignoreExpiration);
    return p?.typ === 'tenant' && isText(p.sub) && isText(p.tid) && isText(p.sid) && typeof p.ver === 'number' ? p : null;
  }

  async verifySupport(token: string, options: { ignoreExpiration?: boolean } = {}): Promise<SupportTokenPayload | null> {
    const p = await this.check<SupportTokenPayload>(this.support, token, options.ignoreExpiration);
    return p?.typ === 'support' && isText(p.sub) && isText(p.tid) && isText(p.ssn) ? p : null;
  }

  async verifyMfa(token: string): Promise<MfaTokenPayload | null> {
    const p = await this.check<MfaTokenPayload>(this.mfa, token);
    return p?.typ === 'mfa' && isText(p.sub) && isText(p.tid) && typeof p.ver === 'number' ? p : null;
  }

  async verifyPlatform(token: string, options: { ignoreExpiration?: boolean } = {}): Promise<PlatformTokenPayload | null> {
    const p = await this.check<PlatformTokenPayload>(this.platform, token, options.ignoreExpiration);
    return p?.typ === 'platform' && isText(p.sub) && isText(p.sid) && typeof p.ver === 'number' ? p : null;
  }

  private async check<T extends object>(jwt: JwtService, token: string, ignoreExpiration = false): Promise<T | null> {
    try {
      return await jwt.verifyAsync<T>(token, { ignoreExpiration });
    } catch {
      return null;
    }
  }
}

@Global()
@Module({ providers: [AccessTokenService], exports: [AccessTokenService] })
export class TokensModule {}
