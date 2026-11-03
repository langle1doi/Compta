import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { NoNullByte } from '../../../../common/validation/no-null-byte';
import { IsStrongPassword } from '../../../../common/validation/validators';
import { SUBDOMAIN_PATTERN } from '../../../tenancy/reserved-subdomains';

export class CreateTenantDto {
  @IsString()
  @NoNullByte()
  @MaxLength(200)
  name: string;

  /** F01 BR-01: 3–30 chars of a-z, 0-9, "-"; becomes <subdomain>.<APP_BASE_DOMAIN> and database tenant_<subdomain> */
  @Matches(SUBDOMAIN_PATTERN, { message: 'subdomain must be 3-30 chars: a-z, 0-9, inner - without --' })
  subdomain: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsString()
  @NoNullByte()
  @MaxLength(50)
  planCode?: string;

  /** Storage region: EU is the only one today (F01 A) */
  @IsOptional()
  @IsIn(['EU'])
  region?: string;

  /** Defaults to the tenant name */
  @IsOptional()
  @IsString()
  @NoNullByte()
  @MaxLength(200)
  companyLegalName?: string;

  @IsOptional()
  @Length(2, 2)
  companyCountryCode?: string;

  @IsOptional()
  @Length(3, 3)
  companyCurrency?: string;

  @IsEmail()
  @MaxLength(320)
  adminEmail: string;

  /** Defaults to the part of the email before @ */
  @IsOptional()
  @IsString()
  @NoNullByte()
  @MaxLength(200)
  adminFullName?: string;

  /** Omitted: the first admin is invited by email */
  @IsOptional()
  @IsStrongPassword()
  adminPassword?: string;
}
