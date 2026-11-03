import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { NormalizedEmail } from '../../../common/validation/validators';
import { MembershipDto } from './membership.dto';

export class InviteUserDto {
  @NormalizedEmail()
  email: string;

  @IsString()
  @MaxLength(200)
  fullName: string;

  @IsOptional()
  @IsIn(['fr', 'en', 'vi'])
  locale?: string;

  /** The role is mandatory: an invitation always says what the person will be able to do. */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MembershipDto)
  memberships: MembershipDto[];
}
