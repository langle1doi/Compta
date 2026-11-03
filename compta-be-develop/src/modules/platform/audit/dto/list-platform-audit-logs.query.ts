import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { NoNullByte } from '../../../../common/validation/no-null-byte';

export class ListPlatformAuditLogsQuery {
  @IsOptional() @IsString() @NoNullByte() @MaxLength(100) action?: string;
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @IsString() @NoNullByte() @MaxLength(320) actorEmail?: string;
  @IsOptional() @IsString() @NoNullByte() @MaxLength(50) targetType?: string;
  @IsOptional() @IsString() @NoNullByte() @MaxLength(100) targetId?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
