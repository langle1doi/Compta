import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class MembershipDto {
  /** null or omitted = role applies to every company of the tenant */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  companyId?: string | null;

  @IsUUID()
  roleId: string;
}
