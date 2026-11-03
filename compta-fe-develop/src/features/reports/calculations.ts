import {
  invoiceDisplayNumber,
  invoiceTotals,
  isInvoiceLocked,
  paidCentsFor,
  remainingCentsFor,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import {
  ledgerToday,
  quoteTotals,
  type CustomerRecord,
  type OwnerRecord,
  type QuoteRecord,
} from "@/features/quotes/model";
import type { ProductRecord } from "@/features/products/model";

import type {
  AgingBucket,
  AgingBucketId,
  AgingDetailRow,
  DateRange,
  ProductPerformanceRow,
  QuotePipelineRow,
  ReportFilters,
  ReportGranularity,
  ReportKpis,
  RevenueBreakdownDimension,
  RevenueBreakdownRow,
  RevenuePoint,
  SalesPerformanceRow,
} from "./model";
import { emptyReportFilters } from "./model";
import {
  enumerateBuckets,
  isDateInRange,
  periodBucketKey,
  periodBucketLabel,
  resolvePeriodRange,
  resolvePreviousPeriodRange,
} from "./period";

export type ReportRawData = {
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  quotes: QuoteRecord[];
  products: ProductRecord[];
  customers: CustomerRecord[];
  owners: OwnerRecord[];
  companies: Array<{ id: string; name: string; currency: string }>;
  activeCompanyId: string;
};

function effectiveCompanyId(filters: ReportFilters, activeCompanyId: string) {
  if (filters.companyId === "all") return "all";
  return filters.companyId ?? activeCompanyId;
}

function invoiceMatchesProduct(invoice: InvoiceRecord, productId: string | null) {
  if (!productId) return true;
  return invoice.lines.some((line) => line.productId === productId);
}

function quoteMatchesProduct(quote: QuoteRecord, productId: string | null) {
  if (!productId) return true;
  return quote.lines.some((line) => line.productId === productId);
}

function invoiceStatusOk(invoice: InvoiceRecord, status: string | null) {
  if (!status) return true;
  return invoice.status === status || invoice.paymentStatus === status;
}

function quoteStatusOk(quote: QuoteRecord, status: string | null) {
  if (!status) return true;
  return quote.status === status;
}

/** Locked invoices eligible as invoiced revenue source. */
export function filterInvoicesForReports(
  invoices: InvoiceRecord[],
  filters: ReportFilters,
  activeCompanyId: string,
  range?: DateRange,
) {
  const companyId = effectiveCompanyId(filters, activeCompanyId);
  return invoices.filter((invoice) => {
    if (!isInvoiceLocked(invoice)) return false;
    if (companyId !== "all" && invoice.companyId !== companyId) return false;
    if (filters.currency && invoice.currency !== filters.currency) return false;
    if (filters.salespersonId && invoice.ownerId !== filters.salespersonId) return false;
    if (filters.customerId && invoice.customerId !== filters.customerId) return false;
    if (!invoiceMatchesProduct(invoice, filters.productId)) return false;
    if (!invoiceStatusOk(invoice, filters.invoiceStatus)) return false;
    if (range && !isDateInRange(invoice.issueDate, range)) return false;
    return true;
  });
}

export function filterQuotesForReports(
  quotes: QuoteRecord[],
  filters: ReportFilters,
  range?: DateRange,
) {
  return quotes.filter((quote) => {
    if (filters.salespersonId && quote.ownerId !== filters.salespersonId) return false;
    if (filters.customerId && quote.customerId !== filters.customerId) return false;
    if (!quoteMatchesProduct(quote, filters.productId)) return false;
    if (!quoteStatusOk(quote, filters.quoteStatus)) return false;
    if (range && !isDateInRange(quote.createdAt, range)) return false;
    return true;
  });
}

export function revenueCentsForInvoice(invoice: InvoiceRecord) {
  return invoiceTotals(invoice).htCents;
}

function resolveLineCostCents(
  line: { productId?: string; label: string; qty: number; unitHtCents: number },
  productsById: Map<string, ProductRecord>,
  productsByName: Map<string, ProductRecord>,
) {
  const byId = line.productId ? productsById.get(line.productId) : undefined;
  const byName = productsByName.get(line.label.trim().toLowerCase());
  const product = byId ?? byName;
  if (!product) return null;
  return product.costCents * line.qty;
}

export function marginForInvoices(
  invoices: InvoiceRecord[],
  products: ProductRecord[],
): { marginCents: number; matchedRevenueCents: number; available: boolean } {
  const productsById = new Map(products.map((item) => [item.id, item]));
  const productsByName = new Map(
    products.map((item) => [item.name.trim().toLowerCase(), item]),
  );

  let marginCents = 0;
  let matchedRevenueCents = 0;
  let totalRevenueCents = 0;

  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      const ht = line.qty * line.unitHtCents;
      totalRevenueCents += ht;
      const cost = resolveLineCostCents(line, productsById, productsByName);
      if (cost === null) continue;
      matchedRevenueCents += ht;
      marginCents += ht - cost;
    }
  }

  const coverage = totalRevenueCents === 0 ? 0 : matchedRevenueCents / totalRevenueCents;
  return {
    marginCents,
    matchedRevenueCents,
    available: totalRevenueCents > 0 && coverage >= 0.5,
  };
}

export function calculateRevenueCents(invoices: InvoiceRecord[]) {
  return invoices.reduce((sum, invoice) => sum + revenueCentsForInvoice(invoice), 0);
}

export function calculateQuoteConversion(quotes: QuoteRecord[]): number | null {
  const eligible = quotes.filter((quote) => quote.status !== "draft");
  if (eligible.length === 0) return null;
  const won = eligible.filter((quote) => quote.status === "accepted").length;
  return won / eligible.length;
}

export function deltaRatio(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return current / previous - 1;
}

export function calculateReportKpis(
  raw: ReportRawData,
  filters: ReportFilters,
  today = ledgerToday,
): ReportKpis {
  const currentRange = resolvePeriodRange(filters.period, today);
  const previousRange = resolvePreviousPeriodRange(filters.period, today);

  const currentInvoices = filterInvoicesForReports(
    raw.invoices,
    filters,
    raw.activeCompanyId,
    currentRange,
  );
  const previousInvoices = filterInvoicesForReports(
    raw.invoices,
    filters,
    raw.activeCompanyId,
    previousRange,
  );

  const revenueCents = calculateRevenueCents(currentInvoices);
  const previousRevenue = calculateRevenueCents(previousInvoices);

  const margin = marginForInvoices(currentInvoices, raw.products);
  const previousMargin = marginForInvoices(previousInvoices, raw.products);

  const aging = calculateAgingBuckets(raw, filters, today);
  const outstandingCents = aging.reduce((sum, bucket) => sum + bucket.amountCents, 0);

  // Previous outstanding: approximate using invoices that were open at end of previous period
  // (same eligibility, snapshot as of previous range end).
  const previousAging = calculateAgingBuckets(raw, filters, previousRange.end);
  const previousOutstanding = previousAging.reduce((sum, bucket) => sum + bucket.amountCents, 0);

  const currentQuotes = filterQuotesForReports(raw.quotes, filters, currentRange);
  const previousQuotes = filterQuotesForReports(raw.quotes, filters, previousRange);
  const conversionRate = calculateQuoteConversion(currentQuotes);
  const previousConversion = calculateQuoteConversion(previousQuotes);

  return {
    revenueCents,
    revenueDeltaRatio: deltaRatio(revenueCents, previousRevenue),
    marginCents: margin.available ? margin.marginCents : null,
    marginPercent:
      margin.available && margin.matchedRevenueCents > 0
        ? margin.marginCents / margin.matchedRevenueCents
        : null,
    marginDeltaRatio:
      margin.available && previousMargin.available
        ? deltaRatio(margin.marginCents, previousMargin.marginCents)
        : null,
    marginAvailable: margin.available,
    outstandingCents,
    outstandingDeltaRatio: deltaRatio(outstandingCents, previousOutstanding),
    conversionRate,
    conversionDeltaRatio:
      conversionRate === null || previousConversion === null
        ? null
        : deltaRatio(conversionRate, previousConversion),
  };
}

export function calculateRevenueTrend(
  raw: ReportRawData,
  filters: ReportFilters,
  granularity: ReportGranularity,
  today = ledgerToday,
): RevenuePoint[] {
  const range = resolvePeriodRange(filters.period, today);
  const previousRange = resolvePreviousPeriodRange(filters.period, today);
  const keys = enumerateBuckets(range, granularity);
  const previousKeys = enumerateBuckets(previousRange, granularity);

  const currentInvoices = filterInvoicesForReports(
    raw.invoices,
    filters,
    raw.activeCompanyId,
    range,
  );
  const previousInvoices = filterInvoicesForReports(
    raw.invoices,
    filters,
    raw.activeCompanyId,
    previousRange,
  );

  const currentByKey = new Map<string, InvoiceRecord[]>();
  for (const invoice of currentInvoices) {
    const key = periodBucketKey(invoice.issueDate, granularity);
    const list = currentByKey.get(key) ?? [];
    list.push(invoice);
    currentByKey.set(key, list);
  }

  const previousByKey = new Map<string, InvoiceRecord[]>();
  for (const invoice of previousInvoices) {
    const key = periodBucketKey(invoice.issueDate, granularity);
    const list = previousByKey.get(key) ?? [];
    list.push(invoice);
    previousByKey.set(key, list);
  }

  return keys.map((key, index) => {
    const invoices = currentByKey.get(key) ?? [];
    const prevKey = previousKeys[index] ?? previousKeys[previousKeys.length - 1];
    const previous = prevKey ? (previousByKey.get(prevKey) ?? []) : [];
    const revenueCents = calculateRevenueCents(invoices);
    const previousRevenueCents = calculateRevenueCents(previous);
    const margin = marginForInvoices(invoices, raw.products);
    return {
      key,
      label: periodBucketLabel(key, granularity),
      revenueCents,
      previousRevenueCents,
      marginCents: margin.available ? margin.marginCents : null,
      marginPercent:
        margin.available && margin.matchedRevenueCents > 0
          ? margin.marginCents / margin.matchedRevenueCents
          : null,
    };
  });
}

function ownerName(owners: OwnerRecord[], id: string) {
  return owners.find((owner) => owner.id === id)?.name ?? id;
}

function customerName(customers: CustomerRecord[], id: string) {
  return customers.find((customer) => customer.id === id)?.name ?? id;
}

export function calculateRevenueBreakdown(
  raw: ReportRawData,
  filters: ReportFilters,
  dimension: RevenueBreakdownDimension,
  today = ledgerToday,
  topN = 5,
): { rows: RevenueBreakdownRow[]; totalCents: number } {
  const range = resolvePeriodRange(filters.period, today);
  const invoices = filterInvoicesForReports(raw.invoices, filters, raw.activeCompanyId, range);
  const totals = new Map<string, { label: string; revenueCents: number }>();

  for (const invoice of invoices) {
    if (dimension === "customer") {
      const id = invoice.customerId;
      const current = totals.get(id) ?? {
        label: invoice.customerName || customerName(raw.customers, id),
        revenueCents: 0,
      };
      current.revenueCents += revenueCentsForInvoice(invoice);
      totals.set(id, current);
    } else if (dimension === "salesperson") {
      const id = invoice.ownerId;
      const current = totals.get(id) ?? {
        label: ownerName(raw.owners, id),
        revenueCents: 0,
      };
      current.revenueCents += revenueCentsForInvoice(invoice);
      totals.set(id, current);
    } else if (dimension === "company") {
      const id = invoice.companyId;
      const company = raw.companies.find((item) => item.id === id);
      const current = totals.get(id) ?? {
        label: company?.name ?? id,
        revenueCents: 0,
      };
      current.revenueCents += revenueCentsForInvoice(invoice);
      totals.set(id, current);
    } else {
      for (const line of invoice.lines) {
        const product =
          (line.productId
            ? raw.products.find((item) => item.id === line.productId)
            : undefined) ??
          raw.products.find(
            (item) => item.name.trim().toLowerCase() === line.label.trim().toLowerCase(),
          );
        const id = product?.id ?? `line:${line.label}`;
        const label = product?.name ?? line.label;
        const current = totals.get(id) ?? { label, revenueCents: 0 };
        current.revenueCents += line.qty * line.unitHtCents;
        totals.set(id, current);
      }
    }
  }

  const sorted = [...totals.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((left, right) => right.revenueCents - left.revenueCents);

  const totalCents = sorted.reduce((sum, row) => sum + row.revenueCents, 0);
  if (sorted.length <= topN) {
    return {
      totalCents,
      rows: sorted.map((row) => ({
        id: row.id,
        label: row.label,
        revenueCents: row.revenueCents,
        sharePercent: totalCents === 0 ? 0 : row.revenueCents / totalCents,
      })),
    };
  }

  const top = sorted.slice(0, topN);
  const otherCents = sorted.slice(topN).reduce((sum, row) => sum + row.revenueCents, 0);
  const rows: RevenueBreakdownRow[] = [
    ...top.map((row) => ({
      id: row.id,
      label: row.label,
      revenueCents: row.revenueCents,
      sharePercent: totalCents === 0 ? 0 : row.revenueCents / totalCents,
    })),
    {
      id: "__other__",
      label: "Other",
      revenueCents: otherCents,
      sharePercent: totalCents === 0 ? 0 : otherCents / totalCents,
    },
  ];
  return { rows, totalCents };
}

function agingBucketFor(daysPastDue: number): AgingBucketId {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "d1_30";
  if (daysPastDue <= 60) return "d31_60";
  if (daysPastDue <= 90) return "d61_90";
  return "d90_plus";
}

function daysBetween(fromIso: string, toIso: string) {
  const from = Date.parse(`${fromIso}T00:00:00`);
  const to = Date.parse(`${toIso}T00:00:00`);
  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
}

/** Point-in-time AR aging — entity filters apply; period does not shrink the snapshot. */
export function filterOutstandingInvoices(
  raw: ReportRawData,
  filters: ReportFilters,
) {
  const companyId = effectiveCompanyId(filters, raw.activeCompanyId);
  return raw.invoices.filter((invoice) => {
    if (!isInvoiceLocked(invoice)) return false;
    if (companyId !== "all" && invoice.companyId !== companyId) return false;
    if (filters.currency && invoice.currency !== filters.currency) return false;
    if (filters.salespersonId && invoice.ownerId !== filters.salespersonId) return false;
    if (filters.customerId && invoice.customerId !== filters.customerId) return false;
    if (!invoiceMatchesProduct(invoice, filters.productId)) return false;
    if (!invoiceStatusOk(invoice, filters.invoiceStatus)) return false;
    return remainingCentsFor(invoice, raw.payments) > 0;
  });
}

export function calculateAgingBuckets(
  raw: ReportRawData,
  filters: ReportFilters,
  asOf = ledgerToday,
): AgingBucket[] {
  const open = filterOutstandingInvoices(raw, filters);
  const bucketIds: AgingBucketId[] = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"];
  const map = new Map<AgingBucketId, { amountCents: number; invoiceIds: string[] }>();
  for (const id of bucketIds) map.set(id, { amountCents: 0, invoiceIds: [] });

  for (const invoice of open) {
    const remaining = remainingCentsFor(invoice, raw.payments);
    const daysPastDue = daysBetween(invoice.dueDate, asOf);
    const bucket = agingBucketFor(daysPastDue);
    const entry = map.get(bucket)!;
    entry.amountCents += remaining;
    entry.invoiceIds.push(invoice.id);
  }

  const total = [...map.values()].reduce((sum, item) => sum + item.amountCents, 0);
  return bucketIds.map((id) => {
    const entry = map.get(id)!;
    return {
      id,
      amountCents: entry.amountCents,
      sharePercent: total === 0 ? 0 : entry.amountCents / total,
      invoiceIds: entry.invoiceIds,
    };
  });
}

export function calculateAgingDetails(
  raw: ReportRawData,
  filters: ReportFilters,
  bucketId?: AgingBucketId,
  asOf = ledgerToday,
): AgingDetailRow[] {
  const open = filterOutstandingInvoices(raw, filters);
  const rows: AgingDetailRow[] = [];

  for (const invoice of open) {
    const remaining = remainingCentsFor(invoice, raw.payments);
    const paid = paidCentsFor(invoice.id, raw.payments);
    const daysPastDue = daysBetween(invoice.dueDate, asOf);
    const agingBucket = agingBucketFor(daysPastDue);
    if (bucketId && agingBucket !== bucketId) continue;
    rows.push({
      invoiceId: invoice.id,
      invoiceNumber: invoiceDisplayNumber(invoice),
      customerName: invoice.customerName,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      daysOverdue: Math.max(0, daysPastDue),
      agingBucket,
      invoiceTotalCents: invoiceTotals(invoice).ttcCents,
      paidCents: paid,
      remainingCents: remaining,
      currency: invoice.currency,
    });
  }

  return rows.sort((left, right) => right.daysOverdue - left.daysOverdue);
}

export function calculateQuotePipeline(
  raw: ReportRawData,
  filters: ReportFilters,
  today = ledgerToday,
): QuotePipelineRow[] {
  const range = resolvePeriodRange(filters.period, today);
  const quotes = filterQuotesForReports(raw.quotes, filters, range);
  const statuses = ["draft", "sent", "review", "accepted", "rejected", "expired"] as const;
  const totalCount = quotes.length;
  const totalValue = quotes.reduce((sum, quote) => sum + quoteTotals(quote).ttcCents, 0);

  return statuses.map((status) => {
    const subset = quotes.filter((quote) => quote.status === status);
    const count = subset.length;
    const valueCents = subset.reduce((sum, quote) => sum + quoteTotals(quote).ttcCents, 0);
    return {
      status,
      count,
      valueCents,
      sharePercent:
        totalCount === 0 && totalValue === 0
          ? 0
          : totalValue === 0
            ? count / Math.max(totalCount, 1)
            : valueCents / totalValue,
    };
  });
}

export function calculateSalesPerformance(
  raw: ReportRawData,
  filters: ReportFilters,
  today = ledgerToday,
): SalesPerformanceRow[] {
  const range = resolvePeriodRange(filters.period, today);
  const invoices = filterInvoicesForReports(raw.invoices, filters, raw.activeCompanyId, range);
  const quotes = filterQuotesForReports(raw.quotes, filters, range);
  const open = filterOutstandingInvoices(raw, filters);

  const ownerIds = new Set<string>([
    ...invoices.map((invoice) => invoice.ownerId),
    ...quotes.map((quote) => quote.ownerId),
    ...open.map((invoice) => invoice.ownerId),
  ]);

  if (filters.salespersonId) {
    ownerIds.clear();
    ownerIds.add(filters.salespersonId);
  }

  return [...ownerIds]
    .map((salespersonId) => {
      const ownerInvoices = invoices.filter((invoice) => invoice.ownerId === salespersonId);
      const ownerQuotes = quotes.filter((quote) => quote.ownerId === salespersonId);
      const won = ownerQuotes.filter((quote) => quote.status === "accepted");
      const outstandingCents = open
        .filter((invoice) => invoice.ownerId === salespersonId)
        .reduce((sum, invoice) => sum + remainingCentsFor(invoice, raw.payments), 0);

      return {
        salespersonId,
        salespersonName: ownerName(raw.owners, salespersonId),
        revenueCents: calculateRevenueCents(ownerInvoices),
        quotesCreated: ownerQuotes.length,
        quotesWon: won.length,
        conversionRate: calculateQuoteConversion(ownerQuotes),
        outstandingCents,
      };
    })
    .sort((left, right) => right.revenueCents - left.revenueCents);
}

export function calculateProductPerformance(
  raw: ReportRawData,
  filters: ReportFilters,
  today = ledgerToday,
): ProductPerformanceRow[] {
  const range = resolvePeriodRange(filters.period, today);
  const invoices = filterInvoicesForReports(raw.invoices, filters, raw.activeCompanyId, range);
  const productsById = new Map(raw.products.map((item) => [item.id, item]));
  const productsByName = new Map(
    raw.products.map((item) => [item.name.trim().toLowerCase(), item]),
  );

  const agg = new Map<
    string,
    {
      product: ProductRecord | null;
      label: string;
      code: string;
      type: string;
      unit: string;
      quantity: number;
      revenueCents: number;
      costCents: number;
      costKnown: boolean;
    }
  >();

  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      const product =
        (line.productId ? productsById.get(line.productId) : undefined) ??
        productsByName.get(line.label.trim().toLowerCase()) ??
        null;
      if (filters.productId && product?.id !== filters.productId && line.productId !== filters.productId) {
        continue;
      }
      const id = product?.id ?? `orphan:${line.label}`;
      const current = agg.get(id) ?? {
        product,
        label: product?.name ?? line.label,
        code: product?.code ?? "—",
        type: product?.type ?? "service",
        unit: product?.unit ?? "unit",
        quantity: 0,
        revenueCents: 0,
        costCents: 0,
        costKnown: Boolean(product),
      };
      const ht = line.qty * line.unitHtCents;
      current.quantity += line.qty;
      current.revenueCents += ht;
      if (product) {
        current.costCents += product.costCents * line.qty;
        current.costKnown = true;
      } else {
        current.costKnown = false;
      }
      agg.set(id, current);
    }
  }

  return [...agg.entries()]
    .map(([productId, value]) => ({
      productId,
      productCode: value.code,
      productName: value.label,
      type: value.type,
      unit: value.unit,
      quantity: value.quantity,
      revenueCents: value.revenueCents,
      averagePriceCents:
        value.quantity === 0 ? 0 : Math.round(value.revenueCents / value.quantity),
      costCents: value.costKnown ? value.costCents : null,
      marginCents: value.costKnown ? value.revenueCents - value.costCents : null,
    }))
    .sort((left, right) => right.revenueCents - left.revenueCents);
}

export function filtersAreDefault(
  filters: ReportFilters,
  activeCompanyId: string,
): boolean {
  return (
    filters.period === emptyReportFilters.period &&
    (filters.companyId === null || filters.companyId === activeCompanyId) &&
    filters.currency === emptyReportFilters.currency &&
    filters.salespersonId === null &&
    filters.customerId === null &&
    filters.productId === null &&
    filters.quoteStatus === null &&
    filters.invoiceStatus === null
  );
}
