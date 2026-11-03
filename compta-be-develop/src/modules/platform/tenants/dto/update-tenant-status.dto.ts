import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { NoNullByte } from '../../../../common/validation/no-null-byte';
import { TenantStatus } from '../../../../generated/control/enums';

const SETTABLE = [TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.DELETED] as const;

export class UpdateTenantStatusDto {
  @IsIn(SETTABLE)
  status: (typeof SETTABLE)[number];

  @IsOptional()
  @IsString()
  @NoNullByte()
  @MaxLength(500)
  reason?: string;

  /** Required to suspend or delete: the exact tenant name, compared as is (F01 A, D). */
  @IsOptional()
  @IsString()
  @NoNullByte()
  @MaxLength(200)
  confirmName?: string;
}
