import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { NoNullByte } from '../../../../common/validation/no-null-byte';
import { IsStrongPassword } from '../../../../common/validation/validators';
import { PlatformAdminStatus } from '../../../../generated/control/enums';

export class CreatePlatformUserDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @NoNullByte()
  @MaxLength(200)
  fullName: string;

  @IsStrongPassword()
  password: string;

  @IsUUID()
  roleId: string;
}

export class UpdatePlatformUserDto {
  @IsOptional()
  @IsString()
  @NoNullByte()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

export class UpdatePlatformUserStatusDto {
  @IsIn([PlatformAdminStatus.ACTIVE, PlatformAdminStatus.DISABLED])
  status: PlatformAdminStatus;
}

export class ListPlatformUsersQuery {
  @IsOptional() @IsIn([PlatformAdminStatus.ACTIVE, PlatformAdminStatus.DISABLED]) status?: PlatformAdminStatus;
  @IsOptional() @IsString() @NoNullByte() @MaxLength(100) keyword?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
