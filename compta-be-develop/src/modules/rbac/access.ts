import { createParamDecorator, ExecutionContext, HttpStatus, SetMetadata } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { DataScope } from '../../generated/tenant/enums';

export const REQUIRED_PERMISSION = 'rbac:permission';

export interface RequiredPermission {
  resource: string;
  action: string;
}

/** Result of the permission check, attached to the request by PermissionGuard. */
export interface AccessContext {
  userId: string;
  /** From the X-Company-Id header (verified to exist and be ACTIVE); null = no company selected. */
  companyId: string | null;
  scope: DataScope;
}

export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(REQUIRED_PERMISSION, { resource, action } satisfies RequiredPermission);

export const Access = createParamDecorator((_: unknown, ctx: ExecutionContext): AccessContext => {
  return ctx.switchToHttp().getRequest().access;
});

const companyRequired = () => new AppException(HttpStatus.BAD_REQUEST, ErrorCode.COMPANY_REQUIRED, 'X-Company-Id header is required');

/**
 * Company to filter company-bound data on. Only TENANT scope may work across all companies.
 * Returns undefined when the caller may see every company.
 */
export function companyFilter(access: AccessContext): string | undefined {
  if (access.companyId) return access.companyId;
  if (access.scope === DataScope.TENANT) return undefined;
  throw companyRequired();
}

/** Company a new record is created in. */
export function requireCompany(access: AccessContext): string {
  if (!access.companyId) throw companyRequired();
  return access.companyId;
}

export function requireTenantScope(access: AccessContext) {
  if (access.scope !== DataScope.TENANT) {
    throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_SCOPE_REQUIRED, 'Tenant-wide permission required');
  }
}

/** F04 AC-03: a record that exists but is outside the caller's data scope answers 403. */
export const outOfScope = () => new AppException(HttpStatus.FORBIDDEN, ErrorCode.OUT_OF_SCOPE, 'Record is outside your data scope');
