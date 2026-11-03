import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../audit/audit.types';
import { Access, AccessContext, RequirePermission } from '../rbac/access';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { TaxRatesService } from './tax-rates.service';

@ApiTags('companies')
@ApiBearerAuth()
@Audit({ entity: 'tax_rate', model: 'taxRate' })
@Controller('companies/:companyId/tax-rates')
export class TaxRatesController {
  constructor(private readonly taxRates: TaxRatesService) {}

  @Get()
  @RequirePermission('company', 'read')
  list(@Access() access: AccessContext, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.taxRates.list(access, companyId);
  }

  @Post()
  @RequirePermission('company', 'manage')
  create(@Access() access: AccessContext, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateTaxRateDto) {
    return this.taxRates.create(access, companyId, dto);
  }

  @Patch(':id')
  @RequirePermission('company', 'manage')
  update(
    @Access() access: AccessContext,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxRateDto,
  ) {
    return this.taxRates.update(access, companyId, id, dto);
  }
}
