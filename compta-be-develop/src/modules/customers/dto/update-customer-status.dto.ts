import { IsEnum } from 'class-validator';
import { CustomerStatus } from '../../../generated/tenant/enums';

export class UpdateCustomerStatusDto {
  @IsEnum(CustomerStatus)
  status: CustomerStatus;
}
