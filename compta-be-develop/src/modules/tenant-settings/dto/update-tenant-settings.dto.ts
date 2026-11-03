import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  @IsOptional()
  @IsUUID()
  defaultCompanyId?: string;
}
