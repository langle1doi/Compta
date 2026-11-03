import { IsEnum, IsString, Matches } from 'class-validator';
import { DataScope } from '../../../generated/tenant/enums';

// No wildcards: every permission is granted explicitly (see permission-catalog.ts)
export class GrantDto {
  @IsString()
  @Matches(/^[a-z_]+$/)
  resource: string;

  @IsString()
  @Matches(/^[a-z_]+$/)
  action: string;

  @IsEnum(DataScope)
  scope: DataScope;
}
