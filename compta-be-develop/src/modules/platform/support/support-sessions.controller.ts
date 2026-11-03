import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformOnly, RequirePlatformPermission } from '../../../common/auth/auth.decorators';
import { Client, ClientInfo } from '../../../common/http/client-info';
import { Actor, AuditActor, NoAudit } from '../../audit/audit.types';
import { Access, AccessContext, RequirePermission, requireTenantScope } from '../../rbac/access';
import { TenantDbService } from '../../tenancy/tenant-db.service';
import { CurrentActor, PlatformActor } from '../audit/platform-actor';
import { GrantSupportDto } from './dto/grant-support.dto';
import { SupportSessionsService } from './support-sessions.service';

/** The tenant admin's side. */
@ApiTags('tenant')
@ApiBearerAuth()
@NoAudit()
@Controller('support-sessions')
export class SupportSessionsController {
  constructor(
    private readonly sessions: SupportSessionsService,
    private readonly tenantDb: TenantDbService,
  ) {}

  @Post()
  @RequirePermission('settings', 'manage')
  grant(@Access() access: AccessContext, @Body() dto: GrantSupportDto, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.sessions.grant(dto, actor);
  }

  @Get()
  @RequirePermission('settings', 'manage')
  list(@Access() access: AccessContext) {
    requireTenantScope(access);
    return this.sessions.list(this.tenantDb.tenantId);
  }

  @Delete(':id')
  @RequirePermission('settings', 'manage')
  revoke(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.sessions.revoke(id, actor);
  }
}

/** The Super Admin's side. */
@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform/api/v1/tenants/:id/support-sessions')
export class PlatformSupportSessionsController {
  constructor(private readonly sessions: SupportSessionsService) {}

  @Get()
  @RequirePlatformPermission('tenant', 'support')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.list(id);
  }

  @Post('enter')
  @RequirePlatformPermission('tenant', 'support')
  enter(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: PlatformActor, @Client() client: ClientInfo) {
    return this.sessions.enter(id, actor, client);
  }
}
