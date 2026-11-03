import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthOnly, CurrentUser, MfaSetupAllowed } from '../../common/auth/auth.decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { Actor, Audit, AuditActor, NoAudit } from '../audit/audit.types';
import { AccountService } from './account.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto, MfaConfirmDto, MfaDisableDto } from './dto/auth-flows.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MfaService } from './mfa.service';

@ApiTags('me')
@ApiBearerAuth()
@AuthOnly()
@Controller('me')
export class MeController {
  constructor(
    private readonly auth: AuthService,
    private readonly account: AccountService,
    private readonly mfa: MfaService,
  ) {}

  @MfaSetupAllowed()
  @Get()
  profile(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Audit({ entity: 'user', action: 'profile_updated' })
  @Patch()
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.account.updateProfile(user.id, dto);
  }

  @NoAudit()
  @MfaSetupAllowed()
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Actor() actor: AuditActor) {
    return this.account.changePassword(user.id, user.sessionId, dto.currentPassword, dto.newPassword, actor);
  }

  @MfaSetupAllowed()
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @Audit({ entity: 'session', action: 'revoked' })
  @MfaSetupAllowed()
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSession(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.auth.deleteSession(user.id, id);
  }

  @Audit({ entity: 'session', action: 'revoked_all' })
  @MfaSetupAllowed()
  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAllSessions(@CurrentUser() user: AuthUser) {
    return this.auth.revokeUserSessions(user.id);
  }

  @NoAudit()
  @MfaSetupAllowed()
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  setupMfa(@CurrentUser() user: AuthUser) {
    return this.mfa.setup(user.id);
  }

  @NoAudit()
  @MfaSetupAllowed()
  @Post('mfa/confirm')
  @HttpCode(HttpStatus.OK)
  confirmMfa(@CurrentUser() user: AuthUser, @Body() dto: MfaConfirmDto, @Actor() actor: AuditActor) {
    return this.mfa.confirm(user.id, dto.code, actor);
  }

  @NoAudit()
  @Post('mfa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  disableMfa(@CurrentUser() user: AuthUser, @Body() dto: MfaDisableDto, @Actor() actor: AuditActor) {
    return this.mfa.disable(user.id, dto.password, dto.code, actor);
  }
}
