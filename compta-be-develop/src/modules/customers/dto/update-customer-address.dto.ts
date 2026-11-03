import { PartialType } from '@nestjs/mapped-types';
import { CustomerAddressDto } from './customer-address.dto';

export class UpdateCustomerAddressDto extends PartialType(CustomerAddressDto) {}
