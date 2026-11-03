import { IsUUID } from 'class-validator';

export class UpdateTenantPlanDto {
  @IsUUID()
  planId: string;
}
