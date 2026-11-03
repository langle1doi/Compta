import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PinoLogger } from 'nestjs-pino';
import { AUTH_ONLY, IS_PUBLIC, PLATFORM_AUTH_ONLY, PLATFORM_ONLY, PLATFORM_PERMISSION } from '../../common/auth/auth.decorators';
import { CompanyStatus, DataScope } from '../../generated/tenant/enums';
import type { TenantDbService } from '../tenancy/tenant-db.service';
import { REQUIRED_PERMISSION } from './access';
import type { EnforcerService } from './enforcer.service';
import { PermissionGuard } from './permission.guard';
import type { PlatformEnforcerService } from './platform-enforcer.service';

const COMPANY = '11111111-1111-4111-8111-111111111111';

function setup(opts: {
  metadata?: Record<string, unknown>;
  header?: string;
  company?: { status: CompanyStatus } | null;
  scope?: DataScope | null;
}) {
  const req: Record<string, unknown> = {
    user: { id: 'u1' },
    header: (name: string) => (name === 'x-company-id' ? opts.header : undefined),
  };
  const handler = () => undefined;
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => opts.metadata?.[key as string] as never);
  const findUnique = jest.fn().mockResolvedValue(opts.company === undefined ? { status: CompanyStatus.ACTIVE } : opts.company);
  const enforcers = { forTenant: jest.fn().mockResolvedValue({}), resolveScope: jest.fn().mockResolvedValue(opts.scope ?? null) };
  const tenantDb = { tenantId: 't1', client: { company: { findUnique } } };
  const guard = new PermissionGuard(
    reflector,
    enforcers as unknown as EnforcerService,
    { can: jest.fn().mockResolvedValue(false) } as unknown as PlatformEnforcerService,
    tenantDb as unknown as TenantDbService,
    { assign: jest.fn() } as unknown as PinoLogger,
  );
  const ctx = {
    getHandler: () => handler,
    getClass: () => Object,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { guard, ctx, req, enforcers, findUnique };
}

const perm = { [REQUIRED_PERMISSION]: { resource: 'customer', action: 'read' } };

describe('PermissionGuard', () => {
  it('denies a route that declares no permission (deny by default)', async () => {
    const { guard, ctx } = setup({});
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
  });

  it('lets @Public and @AuthOnly routes through without a policy check', async () => {
    for (const key of [IS_PUBLIC, AUTH_ONLY]) {
      const { guard, ctx, enforcers } = setup({ metadata: { [key]: true } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(enforcers.resolveScope).not.toHaveBeenCalled();
    }
  });

  it('BE-F01-21: a platform route without a declared permission is denied; a declared one asks Casbin, deny by default', async () => {
    const declared = setup({ metadata: { [PLATFORM_ONLY]: true } });
    await expect(declared.guard.canActivate(declared.ctx)).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });

    const refused = setup({ metadata: { [PLATFORM_ONLY]: true, [PLATFORM_PERMISSION]: { resource: 'tenant', action: 'read' } } });
    await expect(refused.guard.canActivate(refused.ctx)).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
  });

  it('a platform route for any admin needs no permission', async () => {
    const { guard, ctx } = setup({ metadata: { [PLATFORM_ONLY]: true, [PLATFORM_AUTH_ONLY]: true } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects a malformed X-Company-Id', async () => {
    const { guard, ctx } = setup({ metadata: perm, header: 'not-a-uuid', scope: DataScope.TENANT });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an unknown company with 404 COMPANY_NOT_FOUND', async () => {
    const { guard, ctx } = setup({ metadata: perm, header: COMPANY, company: null, scope: DataScope.TENANT });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND', status: 404 });
  });

  it('rejects an inactive company with 403 COMPANY_INACTIVE', async () => {
    const { guard, ctx } = setup({ metadata: perm, header: COMPANY, company: { status: CompanyStatus.INACTIVE }, scope: DataScope.TENANT });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ code: 'COMPANY_INACTIVE', status: 403 });
  });

  it('returns 403 PERMISSION_DENIED when Casbin finds no scope', async () => {
    const { guard, ctx } = setup({ metadata: perm, header: COMPANY, scope: null });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
  });

  it('attaches the resolved access context', async () => {
    const { guard, ctx, req, enforcers } = setup({ metadata: perm, header: COMPANY, scope: DataScope.OWN });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(enforcers.resolveScope).toHaveBeenCalledWith({}, 'u1', COMPANY, 'customer', 'read');
    expect(req.access).toEqual({ userId: 'u1', companyId: COMPANY, scope: DataScope.OWN });
  });
});
