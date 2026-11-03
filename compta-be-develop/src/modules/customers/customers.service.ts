import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AppException, fieldError, validationError } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { normalizeIdentifier } from '../../common/validation/identifiers';
import type { Prisma } from '../../generated/tenant/client';
import { AddressType, CustomerStatus, CustomerType, DataScope, DocumentType, QuoteStatus, UserStatus } from '../../generated/tenant/enums';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { NumberingService } from '../numbering/numbering.service';
import { AccessContext, companyFilter, outOfScope, requireCompany } from '../rbac/access';
import { EnforcerService } from '../rbac/enforcer.service';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQuery } from './dto/list-customers.query';
import { ReassignCustomersDto } from './dto/reassign-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type CustomerFields = Omit<UpdateCustomerDto, 'ownerId'>;

@Injectable()
export class CustomersService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly numbering: NumberingService,
    private readonly enforcers: EnforcerService,
    private readonly audit: AuditService,
  ) {}

  /** F04 BR-03 / F06 AC-04: OWN scope = owned by the user or shared with them. */
  private ownWhere(userId: string): Prisma.CustomerWhereInput {
    return { OR: [{ ownerId: userId }, { shares: { some: { userId } } }] };
  }

  private scopeWhere(access: AccessContext): Prisma.CustomerWhereInput {
    return {
      deletedAt: null,
      companyId: companyFilter(access),
      ...(access.scope === DataScope.OWN && this.ownWhere(access.userId)),
    };
  }

  async list(access: AccessContext, query: ListCustomersQuery) {
    const where: Prisma.CustomerWhereInput = {
      AND: [
        this.scopeWhere(access),
        {
          type: query.type,
          status: query.status ?? CustomerStatus.ACTIVE,
          ownerId: query.ownerId,
          ...(query.tag && { tags: { has: query.tag } }),
          ...(query.search && {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { siret: { contains: query.search.replace(/\s/g, '') } },
            ],
          }),
        },
      ],
    };
    return this.page(where, query);
  }

  listTrash(access: AccessContext, query: ListCustomersQuery) {
    const where: Prisma.CustomerWhereInput = { deletedAt: { not: null }, companyId: companyFilter(access) };
    return this.page(where, query);
  }

  async restore(access: AccessContext, id: string) {
    const found = await this.tenantDb.client.customer.findFirst({
      where: { id, deletedAt: { not: null }, companyId: companyFilter(access) },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Customer not found');
    return this.tenantDb.client.customer.update({ where: { id }, data: { deletedAt: null } });
  }

  private async page(where: Prisma.CustomerWhereInput, query: ListCustomersQuery) {
    const db = this.tenantDb.client;
    const [items, total] = await db.$transaction([
      db.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { owner: { select: { id: true, fullName: true } } },
      }),
      db.customer.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * F04 AC-05. Every customer named must be movable, or nothing moves. The receiver must be able to read customers in
   * each company involved. The open quotes of these customers follow them.
   */
  async reassign(access: AccessContext, dto: ReassignCustomersDto, actor: AuditActor) {
    const invalid = (field: string, code: string, message: string) => fieldError(field, code, message);
    if (dto.fromUserId === dto.toUserId) throw invalid('to_user_id', 'sameUser', 'from_user_id and to_user_id must differ');
    if (dto.customerIds?.length === 0) throw invalid('customer_ids', 'empty', 'customer_ids must not be empty when present');

    const db = this.tenantDb.client;
    const receiver = await db.user.findUnique({ where: { id: dto.toUserId }, select: { status: true } });
    if (receiver?.status !== UserStatus.ACTIVE) throw invalid('to_user_id', 'notActive', 'The receiver must be an active user');

    const companyId = companyFilter(access);
    const where: Prisma.CustomerWhereInput = {
      ownerId: dto.fromUserId,
      deletedAt: null,
      ...(companyId && { companyId }),
      ...(dto.customerIds && { id: { in: dto.customerIds } }),
    };
    return db.$transaction(async (tx) => {
      const customers = await tx.customer.findMany({ where, select: { id: true, companyId: true } });
      if (dto.customerIds && customers.length !== new Set(dto.customerIds).size) {
        throw invalid(
          'customer_ids',
          'notMovable',
          'Some customers do not exist, are not owned by from_user_id, or are outside your company',
        );
      }
      for (const id of new Set(customers.map((c) => c.companyId))) await this.assertAssignee(id, dto.toUserId, 'to_user_id');

      const ids = customers.map((c) => c.id);
      await tx.customer.updateMany({ where: { id: { in: ids } }, data: { ownerId: dto.toUserId } });
      const quotes = await tx.quote.updateMany({
        where: {
          customerId: { in: ids },
          ownerId: dto.fromUserId,
          status: { in: [QuoteStatus.DRAFT, QuoteStatus.PENDING_APPROVAL, QuoteStatus.SENT, QuoteStatus.ACCEPTED] },
        },
        data: { ownerId: dto.toUserId },
      });
      const result = { customers: ids.length, quotes: quotes.count };
      await this.audit.record(
        actor,
        {
          action: 'customer.reassigned',
          entity: 'customer',
          companyId,
          before: { ownerId: dto.fromUserId, customerIds: ids },
          after: { ownerId: dto.toUserId, ...result },
        },
        tx,
      );
      return result;
    });
  }

  async get(access: AccessContext, id: string) {
    await this.findAccessible(access, id);
    return this.tenantDb.client.customer.findUniqueOrThrow({
      where: { id },
      include: {
        contacts: { orderBy: { createdAt: 'asc' } },
        addresses: { orderBy: { createdAt: 'asc' } },
        shares: { select: { user: { select: { id: true, fullName: true } } } },
        owner: { select: { id: true, fullName: true } },
      },
    });
  }

  async create(access: AccessContext, dto: CreateCustomerDto) {
    const companyId = requireCompany(access);
    const { contacts, addresses, ownerId, ...fields } = dto;
    if (!addresses.some((a) => a.type === AddressType.BILLING)) {
      throw fieldError('addresses', 'billingRequired', 'At least one BILLING address is required');
    }
    const owner = await this.resolveOwner(access, companyId, ownerId);
    await this.assertTaxRate(companyId, fields.defaultTaxRateId);

    return this.tenantDb.client.$transaction(async (tx) =>
      tx.customer.create({
        data: {
          ...this.normalize(fields.type, fields),
          companyId,
          code: await this.numbering.next(tx, companyId, DocumentType.CUSTOMER),
          ownerId: owner,
          createdById: access.userId,
          contacts: contacts && { create: contacts },
          addresses: { create: addresses },
        },
        include: { contacts: true, addresses: true },
      }),
    );
  }

  async update(access: AccessContext, id: string, dto: UpdateCustomerDto) {
    const current = await this.findAccessible(access, id);
    const { ownerId, ...fields } = dto;
    await this.assertTaxRate(current.companyId, fields.defaultTaxRateId);
    const owner = ownerId && ownerId !== current.ownerId ? await this.resolveOwner(access, current.companyId, ownerId) : undefined;
    return this.tenantDb.client.customer.update({
      where: { id },
      data: { ...this.normalize(fields.type ?? current.type, fields, current), ownerId: owner },
    });
  }

  /** F06 AC-05: archive (or restore) instead of deleting. */
  async setStatus(access: AccessContext, id: string, status: CustomerStatus) {
    await this.findAccessible(access, id);
    return this.tenantDb.client.customer.update({ where: { id }, data: { status } });
  }

  /** Customers with documents can only be archived (F06 BR-03); others go to the trash (soft delete). */
  async remove(access: AccessContext, id: string) {
    await this.findAccessible(access, id);
    const docs = await this.tenantDb.client.customer.findUniqueOrThrow({
      where: { id },
      select: { _count: { select: { quotes: true, invoices: true, creditNotes: true } } },
    });
    if (docs._count.quotes + docs._count.invoices + docs._count.creditNotes > 0) {
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.CUSTOMER_HAS_DOCUMENTS, 'Customer has documents: archive it instead');
    }
    await this.tenantDb.client.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async share(access: AccessContext, id: string, userId: string) {
    const customer = await this.findAccessible(access, id);
    await this.assertAssignee(customer.companyId, userId, 'userId');
    await this.tenantDb.client.customerShare.upsert({
      where: { customerId_userId: { customerId: id, userId } },
      create: { customerId: id, userId },
      update: {},
    });
  }

  async unshare(access: AccessContext, id: string, userId: string) {
    await this.findAccessible(access, id);
    await this.tenantDb.client.customerShare.deleteMany({ where: { customerId: id, userId } });
  }

  /**
   * Loads a customer the caller may act on.
   * 404 if it does not exist in the selected company; 403 if it exists but is outside the OWN scope (F04 AC-03).
   */
  async findAccessible(access: AccessContext, id: string) {
    const customer = await this.tenantDb.client.customer.findFirst({
      where: { id, deletedAt: null, companyId: companyFilter(access) },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (access.scope === DataScope.OWN) {
      const visible = await this.tenantDb.client.customer.count({ where: { id, ...this.ownWhere(access.userId) } });
      if (!visible) throw outOfScope();
    }
    return customer;
  }

  private async resolveOwner(access: AccessContext, companyId: string, ownerId: string | undefined): Promise<string> {
    if (!ownerId || ownerId === access.userId) return access.userId;
    if (access.scope === DataScope.OWN) throw outOfScope();
    await this.assertAssignee(companyId, ownerId, 'ownerId');
    return ownerId;
  }

  /** Owner/share target must be an ACTIVE user who can read customers in that company (B5). */
  private async assertAssignee(companyId: string, userId: string, field: string) {
    const enforcer = await this.enforcers.forTenant(this.tenantDb.tenantId, this.tenantDb.client);
    const scope = await this.enforcers.resolveScope(enforcer, userId, companyId, 'customer', 'read');
    if (!scope) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.INVALID_ASSIGNEE, 'User cannot access customers of this company', [
        { field, code: ErrorCode.INVALID_ASSIGNEE, message: 'User is not an active member of this company with customer access' },
      ]);
    }
  }

  private async assertTaxRate(companyId: string, taxRateId: string | undefined) {
    if (!taxRateId) return;
    const found = await this.tenantDb.client.taxRate.count({ where: { id: taxRateId, companyId, isActive: true } });
    if (!found) throw fieldError('defaultTaxRateId', 'notFound', 'Unknown or inactive tax rate for this company');
  }

  /** F06 AC-02 / BR-01: type-specific fields and display name. */
  private normalize(type: CustomerType, fields: CustomerFields, current?: { firstName: string | null; lastName: string | null }) {
    const data: CustomerFields = { ...fields };
    if (fields.siret) data.siret = normalizeIdentifier(fields.siret);

    if (type === CustomerType.INDIVIDUAL) {
      Object.assign(data, { siret: null, vatNumber: null, legalForm: null });
      // Display name follows first/last name unless given explicitly
      if (!fields.name && (!current || fields.firstName !== undefined || fields.lastName !== undefined)) {
        data.name = [fields.firstName ?? current?.firstName, fields.lastName ?? current?.lastName].filter(Boolean).join(' ');
      }
    }
    if ((!current && !data.name) || data.name === '') {
      const field = type === CustomerType.INDIVIDUAL ? 'lastName' : 'name';
      throw validationError([{ field, code: 'required', message: `${field} is required` }]);
    }
    return data as Omit<Prisma.CustomerUncheckedCreateInput, 'companyId' | 'code' | 'ownerId'>;
  }
}
