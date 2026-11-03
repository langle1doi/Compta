import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword, NormalizedEmail } from '../../../common/validation/validators';

export class MfaVerifyDto {
  @IsString()
  @MaxLength(2000)
  mfaToken: string;

  @IsString()
  @MaxLength(40)
  code: string;
}

export class RefreshDto {
  @IsString()
  @MaxLength(200)
  refreshToken: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @NormalizedEmail()
  email: string;

  /** Tenant when the host has no subdomain (IP, shared domain). Ignored on a subdomain. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  companyCode?: string;
}

export class ResetPasswordDto {
  @IsString()
  @MaxLength(200)
  token: string;

  @IsStrongPassword()
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword: string;

  @IsStrongPassword()
  newPassword: string;
}

export class MfaConfirmDto {
  @IsString()
  @MaxLength(40)
  code: string;
}

export class MfaDisableDto {
  @IsString()
  @MaxLength(200)
  password: string;

  @IsString()
  @MaxLength(40)
  code: string;
}

export class AcceptInvitationDto {
  @IsStrongPassword()
  password: string;
}

/** Validated by hand in the controller: unknown keys (a client-sent tenant_id) are ignored and errors say 400. */
export class UnifiedLoginWorkspaceDto {
  @Matches(/^(platform|tenant)$/)
  type: 'platform' | 'tenant';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  company_code?: string;
}

export class UnifiedLoginBodyDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;

  workspace: UnifiedLoginWorkspaceDto;
}
