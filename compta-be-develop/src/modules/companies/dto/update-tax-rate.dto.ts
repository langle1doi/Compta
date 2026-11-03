import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTaxRateDto } from './create-tax-rate.dto';

export class UpdateTaxRateDto extends PartialType(CreateTaxRateDto) {
  /** Rates are deactivated, never deleted (documents reference them) */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
