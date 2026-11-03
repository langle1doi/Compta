import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { TaxRatesController } from './tax-rates.controller';
import { TaxRatesService } from './tax-rates.service';

@Module({
  controllers: [CompaniesController, TaxRatesController],
  providers: [CompaniesService, TaxRatesService],
})
export class CompaniesModule {}
