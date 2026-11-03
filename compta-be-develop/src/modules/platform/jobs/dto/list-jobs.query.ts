import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ProvisioningJobStatus, ProvisioningJobType } from '../../../../generated/control/enums';

export class ListJobsQuery {
  @IsOptional() @IsEnum(ProvisioningJobType) type?: ProvisioningJobType;
  @IsOptional() @IsEnum(ProvisioningJobStatus) status?: ProvisioningJobStatus;
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
