import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor, Audit, AuditActor, NoAudit } from '../audit/audit.types';
import { Idempotent } from '../../common/http/idempotency.interceptor';
import { Access, AccessContext, RequirePermission, requireTenantScope } from '../rbac/access';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQuery } from './dto/list-customers.query';
import { ReassignCustomersDto } from './dto/reassign-customers.dto';
import { ShareCustomerDto } from './dto/share-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Audit({ entity: 'customer', model: 'customer' })
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission('customer', 'read')
  list(@Access() access: AccessContext, @Query() query: ListCustomersQuery) {
    return this.customers.list(access, query);
  }

  /** Trash: customers removed without documents; they can be restored. */
  @Get('trash')
  @RequirePermission('customer', 'delete')
  trash(@Access() access: AccessContext, @Query() query: ListCustomersQuery) {
    return this.customers.listTrash(access, query);
  }

  @Get(':id')
  @RequirePermission('customer', 'read')
  get(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(access, id);
  }

  /** F04 AC-05: all or nothing, including the open quotes of these customers. */
  @NoAudit()
  @Post('reassign')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user', 'manage')
  reassign(@Access() access: AccessContext, @Body() dto: ReassignCustomersDto, @Actor() actor: AuditActor) {
    requireTenantScope(access);
    return this.customers.reassign(access, dto, actor);
  }

  @Audit({ entity: 'customer', model: 'customer', action: 'restored' })
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('customer', 'delete')
  restore(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.restore(access, id);
  }

  @Idempotent()
  @Post()
  @RequirePermission('customer', 'write')
  create(@Access() access: AccessContext, @Body() dto: CreateCustomerDto) {
    return this.customers.create(access, dto);
  }

  @Patch(':id')
  @RequirePermission('customer', 'write')
  update(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(access, id, dto);
  }

  @Audit({ entity: 'customer', model: 'customer', action: 'status' })
  @Patch(':id/status')
  @RequirePermission('customer', 'write')
  setStatus(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerStatusDto) {
    return this.customers.setStatus(access, id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customer', 'delete')
  remove(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.remove(access, id);
  }

  @Audit({ entity: 'customer', action: 'shared' })
  @Post(':id/shares')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customer', 'write')
  share(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareCustomerDto) {
    return this.customers.share(access, id, dto.userId);
  }

  @Audit({ entity: 'customer', action: 'unshared' })
  @Delete(':id/shares/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customer', 'write')
  unshare(@Access() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.customers.unshare(access, id, userId);
  }
}
