import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { MembershipDto } from './membership.dto';

export class SetMembershipsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MembershipDto)
  memberships: MembershipDto[];
}
