import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';

// Contacts and addresses have their own endpoints (/customers/:id/contacts, /customers/:id/addresses).
export class UpdateCustomerDto extends PartialType(OmitType(CreateCustomerDto, ['contacts', 'addresses'] as const)) {}
