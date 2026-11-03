import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, PlatformOnly, RequirePlatformPermission } from '../../../common/auth/auth.decorators';
import type { AuthUser } from '../../../common/auth/auth.types';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { Audit } from '../../audit/audit.types';
import { Access, AccessContext, RequirePermission, requireTenantScope } from '../../rbac/access';
import { TenantDbService } from '../../tenancy/tenant-db.service';
import { CurrentActor, PlatformActor } from '../audit/platform-actor';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { TenantExportsService } from './tenant-exports.service';

/** Super Admin: only a tenant that left the platform; an active one exports its own data below. */
@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform/api/v1/tenants/:id/export')
export class PlatformTenantExportsController {
  constructor(
    private readonly exports: TenantExportsService,
    private readonly control: ControlPrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  @Post()
  @RequirePlatformPermission('tenant', 'export')
  @HttpCode(HttpStatus.ACCEPTED)
  async request(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: PlatformActor) {
    const tenant = await this.control.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    this.exports.assertExportableByPlatform(tenant);
    const admin = await this.control.platformAdmin.findUniqueOrThrow({ where: { id: actor.adminId }, select: { email: true } });
    return this.exports.request(tenant, actor.adminId, admin.email, (jobId, tx) =>
      this.audit.record(actor, { action: 'tenant.export', targetType: 'tenant', targetId: id, after: { jobId } }, tx),
    );
  }

  @Get()
  @RequirePlatformPermission('tenant', 'export')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.exports.list(id);
  }

  /** Download links only come from here: reading jobs (Support) gives no access to the data. */
  @Get(':jobId')
  @RequirePlatformPermission('tenant', 'export')
  async get(@Param('id', ParseUUIDPipe) id: string, @Param('jobId', ParseUUIDPipe) jobId: string, @CurrentActor() actor: PlatformActor) {
    const view = await this.exports.get(id, jobId);
    if (view.downloadUrl) {
      await this.audit.recordSafe(actor, { action: 'tenant.export_link', targetType: 'tenant', targetId: id, after: { jobId } });
    }
    return view;
  }
}

/** F01 G, US-05: a tenant admin exports the data of their own tenant. */
@ApiTags('tenant')
@ApiBearerAuth()
@Controller('tenant/export')
export class TenantExportsController {
  constructor(
    private readonly exports: TenantExportsService,
    private readonly tenantDb: TenantDbService,
  ) {}

  @Post()
  @RequirePermission('settings', 'manage')
  @Audit({ entity: 'tenant_export', action: 'request' })
  @HttpCode(HttpStatus.ACCEPTED)
  async request(@Access() access: AccessContext, @CurrentUser() user: AuthUser) {
    requireTenantScope(access);
    const requester = await this.tenantDb.client.user.findUnique({ where: { id: user.id }, select: { email: true } });
    return this.exports.request({ id: this.tenantDb.tenantId }, undefined, requester?.email ?? null, () => Promise.resolve());
  }

  @Get()
  @RequirePermission('settings', 'manage')
  list(@Access() access: AccessContext, @CurrentUser() user: AuthUser) {
    this.assertOwnUser(access, user);
    return this.exports.list(this.tenantDb.tenantId);
  }

  @Get(':jobId')
  @RequirePermission('settings', 'manage')
  get(@Access() access: AccessContext, @CurrentUser() user: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    this.assertOwnUser(access, user);
    return this.exports.get(this.tenantDb.tenantId, jobId);
  }

  /** A support session reads the tenant's screens; it does not take the whole data set away. */
  private assertOwnUser(access: AccessContext, user: AuthUser) {
    if (user.type === 'support')
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.SUPPORT_READ_ONLY, 'Not available in a support session');
    requireTenantScope(access);
  }
}
