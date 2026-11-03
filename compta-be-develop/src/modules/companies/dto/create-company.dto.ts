import { IsDecimal, IsEmail, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { IsIban, IsSiret } from '../../../common/validation/validators';

export class CreateCompanyDto {
  @IsString()
  @MaxLength(200)
  legalName: string;

  @IsOptional() @IsString() @MaxLength(200) tradeName?: string;
  @IsOptional() @Length(2, 2) countryCode?: string;
  @IsOptional() @IsSiret() siret?: string;
  @IsOptional() @IsString() @MaxLength(20) vatNumber?: string;
  @IsOptional() @IsString() @MaxLength(10) nafCode?: string;
  @IsOptional() @IsIban() iban?: string;
  @IsOptional() @IsString() @MaxLength(11) bic?: string;
  @IsOptional() @Length(3, 3) currency?: string;
  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) paymentTermsDays?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) quoteValidityDays?: number;
  @IsOptional() @IsDecimal({ decimal_digits: '0,2' }) quoteApprovalThreshold?: string;
}
