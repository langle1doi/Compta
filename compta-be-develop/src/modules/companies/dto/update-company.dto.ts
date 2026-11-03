import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CompanyStatus } from '../../../generated/tenant/enums';
import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  /** F03 AC-05: companies are deactivated, never deleted */
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}
