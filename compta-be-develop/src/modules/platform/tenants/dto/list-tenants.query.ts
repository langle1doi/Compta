import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { NoNullByte } from '../../../../common/validation/no-null-byte';
import { TenantStatus } from '../../../../generated/control/enums';

export const TENANT_SORTS = [
  'created_at',
  'name',
  'subdomain',
  'status',
  'plan',
  'schema_version',
  'users',
  'companies',
  'storage_bytes',
] as const;

export class ListTenantsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(TenantStatus) status?: TenantStatus;
  /** Plan code */
  @IsOptional() @IsString() @NoNullByte() @MaxLength(50) plan?: string;
  @IsOptional() @IsString() @NoNullByte() @MaxLength(100) keyword?: string;
  @IsOptional() @IsIn(TENANT_SORTS) sort: (typeof TENANT_SORTS)[number] = 'created_at';
  @IsOptional() @IsIn(['asc', 'desc']) order: 'asc' | 'desc' = 'desc';
}
