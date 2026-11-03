import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformOnly, RequirePlatformPermission } from '../../../common/auth/auth.decorators';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { TenantStatus } from '../../../generated/control/enums';
import { PlatformEnforcerService } from '../../rbac/platform-enforcer.service';
import { CurrentActor, PlatformActor } from '../audit/platform-actor';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQuery } from './dto/list-tenants.query';
import { RetryProvisioningDto } from './dto/retry-provisioning.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { TenantsService } from './tenants.service';

@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform/api/v1/tenants')
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly enforcer: PlatformEnforcerService,
  ) {}

  @Get()
  @RequirePlatformPermission('tenant', 'read')
  list(@Query() query: ListTenantsQuery) {
    return this.tenants.list(query);
  }

  @Get(':id')
  @RequirePlatformPermission('tenant', 'read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.get(id);
  }

  /** F01 G: answers at once with the job to follow; the database is created in the background. */
  @Post()
  @RequirePlatformPermission('tenant', 'provision')
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() dto: CreateTenantDto, @CurrentActor() actor: PlatformActor) {
    return this.tenants.create(dto, actor);
  }

  @Post(':id/retry')
  @RequirePlatformPermission('tenant', 'provision')
  @HttpCode(HttpStatus.ACCEPTED)
  retry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RetryProvisioningDto, @CurrentActor() actor: PlatformActor) {
    return this.tenants.retry(id, dto.adminPassword, actor);
  }

  @Post(':id/resend-invite')
  @RequirePlatformPermission('tenant', 'provision')
  @HttpCode(HttpStatus.OK)
  resendInvite(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: PlatformActor) {
    return this.tenants.resendInvite(id, actor);
  }

  @Patch(':id/status')
  @RequirePlatformPermission('tenant', 'manage')
  async setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantStatusDto, @CurrentActor() actor: PlatformActor) {
    if (dto.status === TenantStatus.DELETED && !(await this.enforcer.can(actor.adminId!, 'tenant', 'delete'))) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.PERMISSION_DENIED, 'Missing permission tenant.delete');
    }
    return this.tenants.setStatus(id, dto, actor);
  }

  @Patch(':id/plan')
  @RequirePlatformPermission('tenant', 'manage')
  changePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantPlanDto, @CurrentActor() actor: PlatformActor) {
    return this.tenants.changePlan(id, dto.planId, actor);
  }
}
