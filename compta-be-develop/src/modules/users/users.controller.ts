import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor, Audit, AuditActor, NoAudit } from '../audit/audit.types';
import { MfaService } from '../auth/mfa.service';
import { Access, AccessContext, RequirePermission, requireTenantScope } from '../rbac/access';
import { CreateUserDto } from './dto/create-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { SetMembershipsDto } from './dto/set-memberships.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InvitationsService } from './invitations.service';
import { UsersService } from './users.service';

// Writes require TENANT scope: only a tenant-wide membership can reach it (see casbin/model.conf).
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly invitations: InvitationsService,
    private readonly mfa: MfaService,
  ) {}

  @Get()
  @RequirePermission('user', 'manage')
  list(@Access() access: AccessContext) {
    return this.users.list(access);
  }

  @NoAudit()
  @ApiOperation({ deprecated: true, summary: 'Use POST /users/invitations: the person chooses their own password' })
  @Post()
  @RequirePermission('user', 'manage')
  create(@Access() access: AccessContext, @Body() dto: CreateUserDto, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.users.create(dto, actor);
  }

  @NoAudit()
  @Post('invitations')
  @RequirePermission('user', 'manage')
  invite(@Access() access: AccessContext, @Body() dto: InviteUserDto, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.invitations.invite(dto, actor);
  }

  @NoAudit()
  @Post(':id/invitations/resend')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user', 'manage')
  resendInvitation(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.invitations.resend(id, actor);
  }

  @NoAudit()
  @Delete(':id/invitations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user', 'manage')
  cancelInvitation(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.invitations.cancel(id, actor);
  }

  @Audit({ entity: 'user', model: 'user' })
  @Patch(':id')
  @RequirePermission('user', 'manage')
  update(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    requireTenantScope(access);
    return this.users.update(id, dto);
  }

  @NoAudit()
  @Patch(':id/status')
  @RequirePermission('user', 'manage')
  setStatus(
    @Access() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Actor() actor: AuditActor,
  ) {
    requireTenantScope(access);
    return this.users.setStatus(id, dto.status, actor);
  }

  @NoAudit()
  @Put(':id/memberships')
  @RequirePermission('user', 'manage')
  setMemberships(
    @Access() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMembershipsDto,
    @Actor() actor: AuditActor,
  ) {
    requireTenantScope(access);
    return this.users.setMemberships(id, dto.memberships, actor);
  }

  @NoAudit()
  @Post(':id/mfa/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user', 'manage')
  resetMfa(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.mfa.adminReset(id, actor);
  }
}
