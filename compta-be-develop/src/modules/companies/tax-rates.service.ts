import { Injectable, NotFoundException } from '@nestjs/common';
import { fieldError } from '../../common/errors/app.exception';
import { DataScope } from '../../generated/tenant/enums';
import { AccessContext, outOfScope } from '../rbac/access';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';

@Injectable()
export class TaxRatesService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async list(access: AccessContext, companyId: string) {
    this.assertCompanyAccess(access, companyId);
    return this.tenantDb.client.taxRate.findMany({ where: { companyId }, orderBy: { rate: 'desc' } });
  }

  async create(access: AccessContext, companyId: string, dto: CreateTaxRateDto) {
    this.assertCompanyAccess(access, companyId);
    this.assertRate(dto.rate, dto.legalMention);
    return this.tenantDb.client.$transaction(async (tx) => {
      if (dto.isDefault) await tx.taxRate.updateMany({ where: { companyId }, data: { isDefault: false } });
      return tx.taxRate.create({ data: { ...dto, companyId } });
    });
  }

  async update(access: AccessContext, companyId: string, id: string, dto: UpdateTaxRateDto) {
    this.assertCompanyAccess(access, companyId);
    const current = await this.tenantDb.client.taxRate.findFirst({ where: { id, companyId } });
    if (!current) throw new NotFoundException('Tax rate not found');
    this.assertRate(dto.rate ?? current.rate.toString(), dto.legalMention !== undefined ? dto.legalMention : current.legalMention);
    return this.tenantDb.client.$transaction(async (tx) => {
      if (dto.isDefault) await tx.taxRate.updateMany({ where: { companyId, id: { not: id } }, data: { isDefault: false } });
      return tx.taxRate.update({ where: { id }, data: dto });
    });
  }

  /** F03 BR-04 (also enforced by a CHECK constraint) */
  private assertRate(rate: string, legalMention: string | null | undefined) {
    const value = Number(rate);
    if (!(value >= 0 && value <= 100)) throw fieldError('rate', 'range', 'rate must be between 0 and 100');
    if (value === 0 && !legalMention?.trim()) {
      throw fieldError('legalMention', 'required', 'A 0% rate requires a legal mention (e.g. art. 283-2 CGI)');
    }
  }

  private assertCompanyAccess(access: AccessContext, companyId: string) {
    if (access.scope !== DataScope.TENANT && access.companyId !== companyId) throw outOfScope();
  }
}
