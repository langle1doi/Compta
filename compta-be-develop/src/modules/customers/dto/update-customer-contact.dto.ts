import { PartialType } from '@nestjs/mapped-types';
import { CustomerContactDto } from './customer-contact.dto';

export class UpdateCustomerContactDto extends PartialType(CustomerContactDto) {}
