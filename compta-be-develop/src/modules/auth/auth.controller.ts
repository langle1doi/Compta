import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { Request } from 'express';
import { AccessTokenService } from '../../common/auth/access-token.service';
import { AuthOnly, CurrentUser, MfaSetupAllowed, Public } from '../../common/auth/auth.decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { Client, ClientInfo } from '../../common/http/client-info';
import { EmailThrottle, LoginThrottle, MfaThrottle } from '../../common/http/throttle';
import { TenantStatus } from '../../generated/control/enums';
import { Actor, AuditActor, NoAudit } from '../audit/audit.types';
import { PlatformAuthService } from '../platform/auth/platform-auth.service';
import { currentTenant } from '../tenancy/tenant-context';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { TenantRegistryService } from '../tenancy/tenant-registry.service';
import { AccountService } from './account.service';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, LogoutDto, MfaVerifyDto, RefreshDto, ResetPasswordDto, UnifiedLoginBodyDto } from './dto/auth-flows.dto';
import { LoginDto } from './dto/login.dto';
import { invalidCredentials } from './login-lockout';
import { burnPasswordCheck } from './password';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('auth')
@NoAudit()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly account: AccountService,
    private readonly registry: TenantRegistryService,
    private readonly tokens: AccessTokenService,
    private readonly tenantDb: TenantDbService,
    private readonly platformAuth: PlatformAuthService,
  ) {}

  @Public()
  @LoginThrottle()
  @EmailThrottle()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Client() client: ClientInfo) {
    return this.auth.login(dto, client);
  }

  /**
   * One door for both worlds. The workspace says which: the tenant comes from company_code (the subdomain), and on a
   * subdomain the two must agree. Any tenant id sent by the client is ignored. Every refusal after validation is the
   * same 401, so the answer never tells a wrong code from a wrong password or a suspended company.
   */
  @Public()
  @LoginThrottle()
  @EmailThrottle()
  @Post('unified-login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: UnifiedLoginBodyDto })
  async unifiedLogin(@Body() body: Record<string, unknown>, @Client() client: ClientInfo) {
    const dto = this.parseUnified(body);
    const email = dto.email.trim().toLowerCase();
    const context = currentTenant();

    if (dto.workspace.type === 'platform') {
      if (context) return this.refuse(dto.password);
      return this.platformAuth.login({ email, password: dto.password }, client);
    }

    const code = dto.workspace.company_code!.toLowerCase();
    if (context) {
      if (context.subdomain !== code) return this.refuse(dto.password);
      return this.auth.login({ email, password: dto.password }, client);
    }
    const tenant = await this.registry.findBySubdomain(code);
    if (tenant?.status !== TenantStatus.ACTIVE) return this.refuse(dto.password);
    return this.registry.runIn(tenant, () => this.auth.login({ email, password: dto.password }, client));
  }

  @Public()
  @MfaThrottle()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@Body() dto: MfaVerifyDto, @Client() client: ClientInfo) {
    if (currentTenant()) return this.auth.verifyMfa(dto.mfaToken, dto.code, client);
    const payload = await this.tokens.verifyMfa(dto.mfaToken);
    const tenant = payload && (await this.registry.findById(payload.tid));
    if (tenant?.status !== TenantStatus.ACTIVE) throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.MFA_INVALID_CODE, 'Invalid code');
    return this.registry.runIn(tenant, () => this.auth.verifyMfa(dto.mfaToken, dto.code, client));
  }

  @Public()
  @LoginThrottle()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto, @Client() client: ClientInfo) {
    return this.registry.runForToken(dto.refreshToken, () => this.auth.refresh(dto.refreshToken, client));
  }

  /** Public on purpose: logging out with an expired token, or twice, still succeeds (E-SESS-06). */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutDto, @Headers('authorization') authorization: string | undefined, @Actor() actor: AuditActor) {
    if (!currentTenant()) {
      if (dto.refreshToken) {
        await this.registry
          .runForToken(dto.refreshToken, () => this.auth.logout(undefined, dto.refreshToken, actor))
          .catch(() => undefined);
      }
      return;
    }
    const bearer = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
    const payload = bearer ? await this.tokens.verifyTenant(bearer, { ignoreExpiration: true }) : null;
    const sessionId = payload?.tid === this.tenantDb.tenantId ? payload.sid : undefined;
    await this.auth.logout(sessionId, dto.refreshToken, actor);
  }

  /** Always 202, for known and unknown addresses alike. */
  @Public()
  @LoginThrottle()
  @EmailThrottle()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    if (currentTenant()) {
      this.account.requestReset(dto.email);
    } else if (dto.companyCode) {
      const tenant = await this.registry.findBySubdomain(dto.companyCode.toLowerCase());
      if (tenant?.status === TenantStatus.ACTIVE)
        void this.registry.runIn(tenant, () => Promise.resolve(this.account.requestReset(dto.email)));
    }
    return { accepted: true };
  }

  @Public()
  @LoginThrottle()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto, @Actor() actor: AuditActor) {
    await this.registry
      .runForToken(dto.token, () => this.account.resetPassword(dto.token, dto.newPassword, actor))
      .catch((error: AppException) => {
        // A token of another tenant is just an invalid link here (E-PWD-04)
        if (error.code === ErrorCode.INVALID_TOKEN)
          throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOKEN, 'This link is invalid or has expired');
        throw error;
      });
  }

  @ApiBearerAuth()
  @AuthOnly()
  @MfaSetupAllowed()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /** ?X-Company-Id header selects the company; otherwise the one chosen at login. */
  @ApiBearerAuth()
  @AuthOnly()
  @MfaSetupAllowed()
  @Get('me/permissions')
  permissions(@CurrentUser() user: AuthUser, @Req() req: Request) {
    const header = req.header('x-company-id');
    return this.auth.permissions(user.id, header && UUID.test(header) ? header : null);
  }

  private parseUnified(body: Record<string, unknown>): UnifiedLoginBodyDto {
    const malformed = () => new AppException(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, 'email, password and workspace are required');
    const workspace = plainToInstance(UnifiedLoginBodyDto, body ?? {});
    const errors = validateSync(workspace, { whitelist: false, forbidUnknownValues: false });
    const space = (body?.workspace ?? null) as { type?: unknown; company_code?: unknown } | null;
    const hasWorkspace =
      !!space &&
      (space.type === 'platform' ||
        (space.type === 'tenant' &&
          typeof space.company_code === 'string' &&
          space.company_code.length > 0 &&
          space.company_code.length <= 30));
    if (errors.length > 0 || !hasWorkspace) throw malformed();
    const dto = new UnifiedLoginBodyDto();
    dto.email = workspace.email;
    dto.password = workspace.password;
    dto.workspace = { type: space.type as 'platform' | 'tenant', company_code: space.company_code as string | undefined };
    return dto;
  }

  private async refuse(password: string): Promise<never> {
    await burnPasswordCheck(password);
    throw invalidCredentials();
  }
}
