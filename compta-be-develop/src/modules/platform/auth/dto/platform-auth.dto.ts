import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../../../common/validation/validators';

export class PlatformRefreshDto {
  @IsString()
  @MaxLength(200)
  refreshToken: string;
}

export class PlatformLogoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}

export class PlatformChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword: string;

  @IsStrongPassword()
  newPassword: string;
}
