import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { NoNullByte } from '../../../../common/validation/no-null-byte';

const MAX_LIMIT = 1_000_000_000;

export class CreatePlanDto {
  @Matches(/^[a-z0-9][a-z0-9_-]{1,30}$/, { message: 'code must be 2-31 chars: a-z, 0-9, _, -' })
  code: string;

  @IsString()
  @NoNullByte()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  // E-TEN-13: a limit of 0 or less is no plan at all
  @IsInt() @Min(1) @Max(MAX_LIMIT) maxUsers: number;
  @IsInt() @Min(1) @Max(MAX_LIMIT) maxCompanies: number;
  @IsInt() @Min(1) @Max(MAX_LIMIT) maxInvoicesMonthly: number;
  @IsInt() @Min(1) @Max(MAX_LIMIT) maxAiCallsMonthly: number;
  @IsInt() @Min(1) @Max(MAX_LIMIT) maxStorageGb: number;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
