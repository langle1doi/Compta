import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { GrantDto } from './grant.dto';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Replaces all grants when present */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrantDto)
  grants?: GrantDto[];
}
