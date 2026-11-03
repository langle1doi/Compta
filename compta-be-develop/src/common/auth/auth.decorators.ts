import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth.types';

export const IS_PUBLIC = 'auth:public';
export const AUTH_ONLY = 'auth:authOnly';
export const PLATFORM_ONLY = 'auth:platformOnly';
export const PLATFORM_AUTH_ONLY = 'auth:platformAuthOnly';
export const PLATFORM_PERMISSION = 'auth:platformPermission';
export const MFA_SETUP_ALLOWED = 'auth:mfaSetupAllowed';
export const SUPPORT_READABLE = 'auth:supportReadable';

/** No authentication required. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Any authenticated tenant user, no permission check (e.g. /auth/me). */
export const AuthOnly = () => SetMetadata(AUTH_ONLY, true);

/** Super admin routes: requires a platform token, rejects tenant tokens. */
export const PlatformOnly = () => SetMetadata(PLATFORM_ONLY, true);

/** Any authenticated platform admin, no permission check (profile, logout). Only meaningful with @PlatformOnly. */
export const PlatformAuthOnly = () => SetMetadata(PLATFORM_AUTH_ONLY, true);

/** Platform permission checked by Casbin (domain "platform"). Platform routes without it are denied. */
export const RequirePlatformPermission = (resource: string, action: string) => SetMetadata(PLATFORM_PERMISSION, { resource, action });

/** An @AuthOnly read that a support session needs too; other @AuthOnly routes are a user's profile and stay closed to it. */
export const SupportReadable = () => SetMetadata(SUPPORT_READABLE, true);

/** Stays reachable while the user must first set up 2FA (F02 AC-05). */
export const MfaSetupAllowed = () => SetMetadata(MFA_SETUP_ALLOWED, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});
