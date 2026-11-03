import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { GrantDto } from './grant.dto';

export class CreateRoleDto {
  @Matches(/^[a-z][a-z0-9_]{1,49}$/)
  key: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrantDto)
  grants: GrantDto[];
}
