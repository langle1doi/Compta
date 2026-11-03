import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { NoNullByte } from '../../../../common/validation/no-null-byte';

export class GrantSupportDto {
  /** F01 BR-05: at most 24 hours */
  @IsInt()
  @Min(1)
  @Max(24)
  durationHours: number;

  @IsOptional()
  @IsString()
  @NoNullByte()
  @MaxLength(500)
  reason?: string;
}
