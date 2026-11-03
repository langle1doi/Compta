import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { Prisma } from '../../generated/tenant/client';
import { AddressType } from '../../generated/tenant/enums';
import { AccessContext } from '../rbac/access';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { CustomersService } from './customers.service';
import { CustomerAddressDto } from './dto/customer-address.dto';
import { CustomerContactDto } from './dto/customer-contact.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';
import { UpdateCustomerContactDto } from './dto/update-customer-contact.dto';

/** Contacts and addresses of a customer; access is checked on the parent customer. */
@Injectable()
export class CustomerDetailsService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly customers: CustomersService,
  ) {}

  async addContact(access: AccessContext, customerId: string, dto: CustomerContactDto) {
    await this.customers.findAccessible(access, customerId);
    return this.tenantDb.client.customerContact.create({ data: { ...dto, customerId } });
  }

  async updateContact(access: AccessContext, customerId: string, id: string, dto: UpdateCustomerContactDto) {
    await this.customers.findAccessible(access, customerId);
    await this.findContact(customerId, id);
    return this.tenantDb.client.customerContact.update({ where: { id }, data: dto });
  }

  async removeContact(access: AccessContext, customerId: string, id: string) {
    await this.customers.findAccessible(access, customerId);
    await this.findContact(customerId, id);
    await this.tenantDb.client.customerContact.delete({ where: { id } });
  }

  async addAddress(access: AccessContext, customerId: string, dto: CustomerAddressDto) {
    await this.customers.findAccessible(access, customerId);
    return this.tenantDb.client.customerAddress.create({ data: { ...dto, customerId } });
  }

  async updateAddress(access: AccessContext, customerId: string, id: string, dto: UpdateCustomerAddressDto) {
    await this.customers.findAccessible(access, customerId);
    return this.tenantDb.client.$transaction(async (tx) => {
      const address = await this.findAddress(tx, customerId, id);
      if (address.type === AddressType.BILLING && dto.type && dto.type !== AddressType.BILLING) {
        await this.assertNotLastBilling(tx, customerId);
      }
      return tx.customerAddress.update({ where: { id }, data: dto });
    });
  }

  async removeAddress(access: AccessContext, customerId: string, id: string) {
    await this.customers.findAccessible(access, customerId);
    await this.tenantDb.client.$transaction(async (tx) => {
      const address = await this.findAddress(tx, customerId, id);
      if (address.type === AddressType.BILLING) await this.assertNotLastBilling(tx, customerId);
      await tx.customerAddress.delete({ where: { id } });
    });
  }

  private async findContact(customerId: string, id: string) {
    const contact = await this.tenantDb.client.customerContact.findFirst({ where: { id, customerId } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  private async findAddress(tx: Prisma.TransactionClient, customerId: string, id: string) {
    const address = await tx.customerAddress.findFirst({ where: { id, customerId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  /** F06 BR-01: a customer keeps at least one billing address. Locks the customer row to serialize. */
  private async assertNotLastBilling(tx: Prisma.TransactionClient, customerId: string) {
    await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customerId}::uuid FOR UPDATE`;
    const billing = await tx.customerAddress.count({ where: { customerId, type: AddressType.BILLING } });
    if (billing <= 1) {
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.LAST_BILLING_ADDRESS, 'A customer must keep at least one billing address');
    }
  }
}
