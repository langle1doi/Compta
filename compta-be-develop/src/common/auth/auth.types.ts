export type TokenType = 'tenant' | 'platform' | 'support';

/** Previous token shape, removed once every issuer uses AccessTokenService. */
export interface JwtPayload {
  sub: string;
  typ: TokenType;
  tid?: string;
  ver?: number;
}

/** Tenant access token. Roles and companies stay on the server (read per request) so a change applies immediately. */
export interface TenantTokenPayload {
  sub: string;
  typ: 'tenant';
  tid: string;
  ver: number;
  sid: string;
}

export interface PlatformTokenPayload {
  sub: string;
  typ: 'platform';
  ver: number;
  sid: string;
}

/** F01 BR-05: a platform admin inside a tenant, only while the support session `ssn` stays valid. */
export interface SupportTokenPayload {
  sub: string;
  typ: 'support';
  tid: string;
  ssn: string;
  email: string;
}

/** Second login step: proves the password was right, opens nothing else. */
export interface MfaTokenPayload {
  sub: string;
  typ: 'mfa';
  tid: string;
  ver: number;
}

export interface AuthUser {
  id: string;
  type: TokenType;
  tenantId?: string;
  sessionId?: string;
  supportSessionId?: string;
  email?: string;
}
