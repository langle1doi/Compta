import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsIn(['fr', 'en', 'vi']) locale?: string;
  @IsOptional() @IsString() @MaxLength(2000) emailSignature?: string;
  /** Company selected in the header: selected again at the next login (F02 AC-01). */
  @IsOptional() @IsUUID() lastCompanyId?: string;
}
