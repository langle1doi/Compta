import { Injectable, NotFoundException } from '@nestjs/common';
import { validationError } from '../../common/errors/app.exception';
import { FieldError } from '../../common/errors/error-codes';
import { normalizeIdentifier } from '../../common/validation/identifiers';
import { CompanyStatus, DataScope } from '../../generated/tenant/enums';
import { AccessContext, outOfScope } from '../rbac/access';
import { PlanLimitsService } from '../tenancy/plan-limits.service';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { seedDefaultTaxRates } from './default-tax-rates';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

// F03 AC-01: mandatory legal data for a French company (printed on every invoice)
const FR_REQUIRED: (keyof CreateCompanyDto)[] = ['siret', 'vatNumber', 'iban', 'addressLine1', 'postalCode', 'city'];

@Injectable()
export class CompaniesService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  /** Companies the user can switch to (company selector, F02 AC-06). */
  listAll() {
    return this.tenantDb.client.company.findMany({ orderBy: { legalName: 'asc' } });
  }

  async listForUser(userId: string) {
    const db = this.tenantDb.client;
    const memberships = await db.membership.findMany({ where: { userId }, select: { companyId: true } });
    const tenantWide = memberships.some((m) => m.companyId === null);
    return db.company.findMany({
      where: tenantWide ? {} : { id: { in: memberships.map((m) => m.companyId!) }, status: CompanyStatus.ACTIVE },
      orderBy: { legalName: 'asc' },
    });
  }

  async create(dto: CreateCompanyDto) {
    const countryCode = dto.countryCode ?? 'FR';
    if (countryCode === 'FR') this.assertFrenchLegalData(dto);
    await this.planLimits.assertCanAdd('companies');
    return this.tenantDb.client.$transaction(async (tx) => {
      const company = await tx.company.create({ data: this.normalize({ ...dto, countryCode }) });
      await seedDefaultTaxRates(tx, company.id, countryCode);
      return company;
    });
  }

  async update(access: AccessContext, id: string, dto: UpdateCompanyDto) {
    if (access.scope !== DataScope.TENANT && access.companyId !== id) throw outOfScope();
    const current = await this.tenantDb.client.company.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Company not found');
    if (dto.status === CompanyStatus.ACTIVE && current.status !== CompanyStatus.ACTIVE) {
      await this.planLimits.assertCanAdd('companies');
    }
    const merged = { ...current, ...dto } as CreateCompanyDto;
    if (merged.countryCode === 'FR') this.assertFrenchLegalData(merged);
    return this.tenantDb.client.company.update({ where: { id }, data: this.normalize(dto) });
  }

  private assertFrenchLegalData(dto: CreateCompanyDto) {
    const missing: FieldError[] = FR_REQUIRED.filter((f) => !dto[f]).map((field) => ({
      field,
      code: 'required',
      message: `${field} is required for a French company`,
    }));
    if (missing.length > 0) throw validationError(missing);
  }

  private normalize<T extends Partial<CreateCompanyDto>>(dto: T): T {
    return {
      ...dto,
      siret: dto.siret && normalizeIdentifier(dto.siret),
      iban: dto.iban && normalizeIdentifier(dto.iban),
    };
  }
}
