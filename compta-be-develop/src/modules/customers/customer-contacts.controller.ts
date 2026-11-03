import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../audit/audit.types';
import { Access, AccessContext, RequirePermission } from '../rbac/access';
import { CustomerDetailsService } from './customer-details.service';
import { CustomerContactDto } from './dto/customer-contact.dto';
import { UpdateCustomerContactDto } from './dto/update-customer-contact.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Audit({ entity: 'customer_contact', model: 'customerContact' })
@Controller('customers/:customerId/contacts')
export class CustomerContactsController {
  constructor(private readonly details: CustomerDetailsService) {}

  @Post()
  @RequirePermission('customer', 'write')
  add(@Access() access: AccessContext, @Param('customerId', ParseUUIDPipe) customerId: string, @Body() dto: CustomerContactDto) {
    return this.details.addContact(access, customerId, dto);
  }

  @Patch(':id')
  @RequirePermission('customer', 'write')
  update(
    @Access() access: AccessContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerContactDto,
  ) {
    return this.details.updateContact(access, customerId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customer', 'write')
  remove(@Access() access: AccessContext, @Param('customerId', ParseUUIDPipe) customerId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.details.removeContact(access, customerId, id);
  }
}
