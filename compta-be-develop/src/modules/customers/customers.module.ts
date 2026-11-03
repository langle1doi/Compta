import { Module } from '@nestjs/common';
import { CustomerAddressesController } from './customer-addresses.controller';
import { CustomerContactsController } from './customer-contacts.controller';
import { CustomerDetailsService } from './customer-details.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController, CustomerContactsController, CustomerAddressesController],
  providers: [CustomersService, CustomerDetailsService],
})
export class CustomersModule {}
