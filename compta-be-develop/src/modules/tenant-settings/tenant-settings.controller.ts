import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor, AuditActor, NoAudit } from '../audit/audit.types';
import { Access, AccessContext, RequirePermission, requireTenantScope } from '../rbac/access';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { TenantSettingsService } from './tenant-settings.service';

@ApiTags('tenant')
@ApiBearerAuth()
@NoAudit()
@Controller('tenant/settings')
export class TenantSettingsController {
  constructor(private readonly settings: TenantSettingsService) {}

  @Get()
  @RequirePermission('settings', 'manage')
  get() {
    return this.settings.get();
  }

  @Patch()
  @RequirePermission('settings', 'manage')
  update(@Access() access: AccessContext, @Body() dto: UpdateTenantSettingsDto, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.settings.update(dto, actor);
  }
}
