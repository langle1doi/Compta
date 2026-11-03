import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { CustomerStatus, CustomerType } from '../../../generated/tenant/enums';

export class ListCustomersQuery {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(CustomerType) type?: CustomerType;
  /** Defaults to ACTIVE */
  @IsOptional() @IsEnum(CustomerStatus) status?: CustomerStatus;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() @MaxLength(50) tag?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
