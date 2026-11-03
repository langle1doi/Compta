import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { IsStrongPassword, NormalizedEmail } from '../../../common/validation/validators';
import { MembershipDto } from './membership.dto';

export class CreateUserDto {
  @NormalizedEmail()
  email: string;

  @IsString()
  @MaxLength(200)
  fullName: string;

  // Deprecated route: POST /users/invitations lets the person choose their own password
  @IsStrongPassword()
  password: string;

  @IsOptional()
  @IsIn(['fr', 'en', 'vi'])
  locale?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MembershipDto)
  memberships: MembershipDto[];
}
