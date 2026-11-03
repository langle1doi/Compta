import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor, AuditActor, NoAudit } from '../audit/audit.types';
import { Access, AccessContext, RequirePermission, requireTenantScope } from './access';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

// Role administration is tenant-wide: a company-level membership never reaches TENANT scope.
@ApiTags('roles')
@ApiBearerAuth()
@NoAudit()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('permissions')
  @RequirePermission('role', 'manage')
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Get()
  @RequirePermission('role', 'manage')
  list() {
    return this.roles.list();
  }

  @Get(':id')
  @RequirePermission('role', 'manage')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.get(id);
  }

  @Post()
  @RequirePermission('role', 'manage')
  create(@Access() access: AccessContext, @Body() dto: CreateRoleDto, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.roles.create(dto, actor);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('role', 'manage')
  update(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.roles.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('role', 'manage')
  remove(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.roles.remove(id, actor);
  }
}
