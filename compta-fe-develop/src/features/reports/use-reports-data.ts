"use client";

import { useMemo } from "react";

import { useInvoices, useInvoicePayments } from "@/features/invoices/store";
import { useProducts } from "@/features/products/store";
import { ledgerToday, quoteTotals } from "@/features/quotes/model";
import { owners, seedCustomers } from "@/features/quotes/seed";
import { useLedger } from "@/features/quotes/store";
import { useCurrentCompany } from "@/features/settings/company-store";
import { getActiveCompanies } from "@/features/settings/mocks/companies";

import {
  calculateAgingBuckets,
  calculateAgingDetails,
  calculateProductPerformance,
  calculateQuotePipeline,
  calculateReportKpis,
  calculateRevenueBreakdown,
  calculateRevenueTrend,
  calculateSalesPerformance,
  filterQuotesForReports,
  type ReportRawData,
} from "./calculations";
import { mergeDemoProductRows } from "./demo-product-rows";
import { mergeDemoSalesRows } from "./demo-sales-rows";
import type {
  PipelineMetric,
  ReportFilters,
  ReportGranularity,
  RevenueBreakdownDimension,
} from "./model";
import { resolvePeriodRange } from "./period";

export function useReportsRawData(): ReportRawData {
  const { companyId } = useCurrentCompany();
  const invoices = useInvoices();
  const payments = useInvoicePayments();
  const products = useProducts();
  const ledger = useLedger();

  return useMemo(() => {
    const companies = getActiveCompanies().map((company) => ({
      id: company.id,
      name: company.name,
      currency: company.currency,
    }));
    return {
      invoices,
      payments,
      quotes: ledger.quotes,
      products,
      customers: ledger.customers.length > 0 ? ledger.customers : seedCustomers,
      owners,
      companies,
      activeCompanyId: companyId,
    };
  }, [companyId, invoices, ledger.customers, ledger.quotes, payments, products]);
}

export function useDerivedReports(
  filters: ReportFilters,
  options: {
    granularity: ReportGranularity;
    breakdownDimension: RevenueBreakdownDimension;
    pipelineMetric: PipelineMetric;
  },
) {
  const raw = useReportsRawData();

  return useMemo(() => {
    const range = resolvePeriodRange(filters.period, ledgerToday);
    const kpis = calculateReportKpis(raw, filters, ledgerToday);
    const trend = calculateRevenueTrend(raw, filters, options.granularity, ledgerToday);
    const breakdown = calculateRevenueBreakdown(
      raw,
      filters,
      options.breakdownDimension,
      ledgerToday,
    );
    const aging = calculateAgingBuckets(raw, filters, ledgerToday);
    const agingDetails = calculateAgingDetails(raw, filters, undefined, ledgerToday);
    const pipeline = calculateQuotePipeline(raw, filters, ledgerToday);
    const sales = mergeDemoSalesRows(
      calculateSalesPerformance(raw, filters, ledgerToday),
      { includeDemo: filters.salespersonId === null },
    );
    const products = mergeDemoProductRows(
      calculateProductPerformance(raw, filters, ledgerToday),
      { includeDemo: filters.productId === null },
    );
    const pipelineQuotes = filterQuotesForReports(raw.quotes, filters, range).map((quote) => {
      const totals = quoteTotals(quote);
      return {
        id: quote.id,
        customerName:
          raw.customers.find((customer) => customer.id === quote.customerId)?.name ??
          quote.customerId,
        salespersonName:
          raw.owners.find((owner) => owner.id === quote.ownerId)?.name ?? quote.ownerId,
        createdAt: quote.createdAt,
        validUntil: quote.validUntil,
        status: quote.status,
        htCents: totals.htCents,
        ttcCents: totals.ttcCents,
        currency: filters.currency,
      };
    });

    return {
      raw,
      range,
      kpis,
      trend,
      breakdown,
      aging,
      agingDetails,
      pipeline,
      sales,
      products,
      pipelineQuotes,
    };
  }, [filters, options.breakdownDimension, options.granularity, raw]);
}
