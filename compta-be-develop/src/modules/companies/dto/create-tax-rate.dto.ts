import { IsBoolean, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaxRateDto {
  /** Percentage, e.g. "20.00" */
  @IsNumberString()
  rate: string;

  @IsString()
  @MaxLength(100)
  label: string;

  /** Mandatory when rate is 0 (F03 BR-04), e.g. "Autoliquidation - article 283-2 du CGI" */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  legalMention?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
