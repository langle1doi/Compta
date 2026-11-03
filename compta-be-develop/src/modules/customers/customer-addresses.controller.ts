import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../audit/audit.types';
import { Access, AccessContext, RequirePermission } from '../rbac/access';
import { CustomerDetailsService } from './customer-details.service';
import { CustomerAddressDto } from './dto/customer-address.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Audit({ entity: 'customer_address', model: 'customerAddress' })
@Controller('customers/:customerId/addresses')
export class CustomerAddressesController {
  constructor(private readonly details: CustomerDetailsService) {}

  @Post()
  @RequirePermission('customer', 'write')
  add(@Access() access: AccessContext, @Param('customerId', ParseUUIDPipe) customerId: string, @Body() dto: CustomerAddressDto) {
    return this.details.addAddress(access, customerId, dto);
  }

  @Patch(':id')
  @RequirePermission('customer', 'write')
  update(
    @Access() access: AccessContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    return this.details.updateAddress(access, customerId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customer', 'write')
  remove(@Access() access: AccessContext, @Param('customerId', ParseUUIDPipe) customerId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.details.removeAddress(access, customerId, id);
  }
}
