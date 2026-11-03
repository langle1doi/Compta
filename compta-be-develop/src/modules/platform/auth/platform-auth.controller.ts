import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, PlatformAuthOnly, PlatformOnly, Public } from '../../../common/auth/auth.decorators';
import type { AuthUser } from '../../../common/auth/auth.types';
import { Client, ClientInfo } from '../../../common/http/client-info';
import { EmailThrottle, LoginThrottle } from '../../../common/http/throttle';
import { LoginDto } from '../../auth/dto/login.dto';
import { PlatformChangePasswordDto, PlatformLogoutDto, PlatformRefreshDto } from './dto/platform-auth.dto';
import { PlatformAuthService } from './platform-auth.service';

@ApiTags('platform')
@Controller('platform/api/v1/auth')
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Public()
  @LoginThrottle()
  @EmailThrottle()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Client() client: ClientInfo) {
    return this.auth.login(dto, client);
  }

  @Public()
  @LoginThrottle()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: PlatformRefreshDto, @Client() client: ClientInfo) {
    return this.auth.refresh(dto.refreshToken, client);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: PlatformLogoutDto, @Headers('authorization') authorization: string | undefined, @Client() client: ClientInfo) {
    return this.auth.logout(/^Bearer (\S+)$/.exec(authorization ?? '')?.[1], dto.refreshToken, client);
  }

  @ApiBearerAuth()
  @PlatformOnly()
  @PlatformAuthOnly()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @PlatformOnly()
  @PlatformAuthOnly()
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: PlatformChangePasswordDto, @Client() client: ClientInfo) {
    return this.auth.changePassword(user.id, user.sessionId, dto.currentPassword, dto.newPassword, client);
  }
}
