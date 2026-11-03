import type { CsvCell } from "@/lib/csv-export";
import { centsToCsvEuro, downloadCsv } from "@/lib/csv-export";

import type {
  AgingDetailRow,
  DateRange,
  ProductPerformanceRow,
  RevenueBreakdownRow,
  RevenuePoint,
  SalesPerformanceRow,
} from "./model";
import { filenamePeriodStamp } from "./period";

export type ExportResult = { ok: true; rowCount: number } | { ok: false; reason: "empty" };

export type ReportExportId =
  | "revenue"
  | "receivables-aging"
  | "quote-pipeline"
  | "sales-performance"
  | "product-performance"
  | "fec";

export type ExportColumnKind =
  | "text"
  | "money"
  | "percent"
  | "number"
  | "delta_money"
  | "delta_percent"
  | "bucket"
  | "date";

export type ExportColumnDef = {
  id: string;
  /** Machine/business CSV header */
  header: string;
  /** i18n key under reports.preview.columns.* */
  labelKey: string;
  kind: ExportColumnKind;
  searchable?: boolean;
};

/** One canonical export payload — drives Preview and CSV download. */
export type CanonicalExportDataset = {
  id: ReportExportId;
  filename: string;
  columns: ExportColumnDef[];
  /** CSV cell matrix aligned with `columns` */
  rows: CsvCell[][];
};

export function downloadCanonicalDataset(dataset: CanonicalExportDataset): ExportResult {
  if (dataset.rows.length === 0) return { ok: false, reason: "empty" };
  downloadCsv(
    dataset.filename,
    dataset.columns.map((column) => column.header),
    dataset.rows,
  );
  return { ok: true, rowCount: dataset.rows.length };
}

function yearStamp(range: DateRange) {
  return range.end.slice(0, 4);
}

function rangeStamp(range: DateRange) {
  return filenamePeriodStamp(range);
}

function moneyDeltaCsv(currentCents: number, previousCents: number): string {
  return centsToCsvEuro(currentCents - previousCents);
}

function percentDeltaCsv(currentCents: number, previousCents: number): string {
  if (previousCents === 0) return "";
  return (((currentCents - previousCents) / previousCents) * 100).toFixed(2);
}

const revenueColumns: ExportColumnDef[] = [
  { id: "period", header: "period", labelKey: "period", kind: "text", searchable: true },
  { id: "currency", header: "currency", labelKey: "currency", kind: "text" },
  { id: "revenue", header: "revenue", labelKey: "revenue", kind: "money" },
  {
    id: "previous",
    header: "previous_period_revenue",
    labelKey: "previousPeriod",
    kind: "money",
  },
  { id: "delta", header: "delta", labelKey: "delta", kind: "delta_money" },
  { id: "deltaPercent", header: "delta_percent", labelKey: "deltaPercent", kind: "delta_percent" },
  {
    id: "margin",
    header: "gross_margin_amount",
    labelKey: "grossMargin",
    kind: "money",
  },
  {
    id: "marginPercent",
    header: "gross_margin_percent",
    labelKey: "grossMarginPercent",
    kind: "percent",
  },
];

export function buildRevenueExportDataset(
  points: RevenuePoint[],
  range: DateRange,
  currency: string,
): CanonicalExportDataset {
  return {
    id: "revenue",
    filename: `compte-revenue-${yearStamp(range)}.csv`,
    columns: revenueColumns,
    rows: points.map((point) => [
      point.label || point.key,
      currency,
      centsToCsvEuro(point.revenueCents),
      centsToCsvEuro(point.previousRevenueCents),
      moneyDeltaCsv(point.revenueCents, point.previousRevenueCents),
      percentDeltaCsv(point.revenueCents, point.previousRevenueCents),
      point.marginCents === null ? "" : centsToCsvEuro(point.marginCents),
      point.marginPercent === null ? "" : (point.marginPercent * 100).toFixed(2),
    ]),
  };
}

const breakdownColumns = (entityCol: string, labelKey: string): ExportColumnDef[] => [
  { id: "entity", header: entityCol, labelKey, kind: "text", searchable: true },
  { id: "currency", header: "currency", labelKey: "currency", kind: "text" },
  { id: "revenue", header: "revenue", labelKey: "revenue", kind: "money" },
  { id: "share", header: "share_percent", labelKey: "sharePercent", kind: "percent" },
];

export function buildBreakdownExportDataset(
  rows: RevenueBreakdownRow[],
  dimension: string,
  range: DateRange,
  currency: string,
): CanonicalExportDataset {
  const entityCol =
    dimension === "customer"
      ? "customer"
      : dimension === "salesperson"
        ? "salesperson"
        : dimension === "product"
          ? "product_name"
          : "company";
  const labelKey =
    dimension === "customer"
      ? "customer"
      : dimension === "salesperson"
        ? "salesperson"
        : dimension === "product"
          ? "productName"
          : "company";

  return {
    id: "revenue",
    filename: `compte-revenue-by-${dimension}-${rangeStamp(range)}.csv`,
    columns: breakdownColumns(entityCol, labelKey),
    rows: rows.map((row) => [
      row.label,
      currency,
      centsToCsvEuro(row.revenueCents),
      (row.sharePercent * 100).toFixed(2),
    ]),
  };
}

const agingColumns: ExportColumnDef[] = [
  {
    id: "invoiceNumber",
    header: "invoice_number",
    labelKey: "invoiceNumber",
    kind: "text",
    searchable: true,
  },
  { id: "customer", header: "customer", labelKey: "customer", kind: "text", searchable: true },
  { id: "issueDate", header: "issue_date", labelKey: "issueDate", kind: "date" },
  { id: "dueDate", header: "due_date", labelKey: "dueDate", kind: "date" },
  { id: "daysOverdue", header: "days_overdue", labelKey: "daysOverdue", kind: "number" },
  {
    id: "agingBucket",
    header: "aging_bucket",
    labelKey: "agingBucket",
    kind: "bucket",
    searchable: true,
  },
  { id: "invoiceTotal", header: "invoice_total", labelKey: "invoiceTotal", kind: "money" },
  { id: "paid", header: "paid_amount", labelKey: "alreadyPaid", kind: "money" },
  { id: "remaining", header: "remaining_balance", labelKey: "remainingBalance", kind: "money" },
  { id: "currency", header: "currency", labelKey: "currency", kind: "text" },
];

export function buildAgingExportDataset(
  rows: AgingDetailRow[],
  asOf: string,
): CanonicalExportDataset {
  return {
    id: "receivables-aging",
    filename: `compte-receivables-aging-${asOf}.csv`,
    columns: agingColumns,
    rows: rows.map((row) => [
      row.invoiceNumber,
      row.customerName,
      row.issueDate,
      row.dueDate,
      row.daysOverdue,
      row.agingBucket,
      centsToCsvEuro(row.invoiceTotalCents),
      centsToCsvEuro(row.paidCents),
      centsToCsvEuro(row.remainingCents),
      row.currency,
    ]),
  };
}

export type PipelineQuoteExportRow = {
  id: string;
  customerName: string;
  salespersonName: string;
  createdAt: string;
  validUntil: string;
  status: string;
  htCents: number;
  ttcCents: number;
  currency: string;
};

const pipelineColumns: ExportColumnDef[] = [
  {
    id: "quoteNumber",
    header: "quote_number",
    labelKey: "quoteNumber",
    kind: "text",
    searchable: true,
  },
  { id: "customer", header: "customer", labelKey: "customer", kind: "text", searchable: true },
  {
    id: "salesperson",
    header: "salesperson",
    labelKey: "salesperson",
    kind: "text",
    searchable: true,
  },
  { id: "createdDate", header: "created_date", labelKey: "createdDate", kind: "date" },
  { id: "validUntil", header: "valid_until", labelKey: "validUntil", kind: "date" },
  { id: "status", header: "status", labelKey: "status", kind: "text", searchable: true },
  { id: "ht", header: "amount_ht", labelKey: "ht", kind: "money" },
  { id: "ttc", header: "amount_ttc", labelKey: "ttc", kind: "money" },
  { id: "currency", header: "currency", labelKey: "currency", kind: "text" },
];

export function buildPipelineExportDataset(
  quotes: PipelineQuoteExportRow[],
  range: DateRange,
): CanonicalExportDataset {
  return {
    id: "quote-pipeline",
    filename: `compte-quote-pipeline-${yearStamp(range)}.csv`,
    columns: pipelineColumns,
    rows: quotes.map((quote) => [
      quote.id,
      quote.customerName,
      quote.salespersonName,
      quote.createdAt,
      quote.validUntil,
      quote.status,
      centsToCsvEuro(quote.htCents),
      centsToCsvEuro(quote.ttcCents),
      quote.currency,
    ]),
  };
}

const salesColumns: ExportColumnDef[] = [
  {
    id: "salesperson",
    header: "salesperson",
    labelKey: "salesperson",
    kind: "text",
    searchable: true,
  },
  { id: "currency", header: "currency", labelKey: "currency", kind: "text" },
  { id: "revenue", header: "revenue", labelKey: "revenue", kind: "money" },
  { id: "quotesCreated", header: "quotes_created", labelKey: "quotesCreated", kind: "number" },
  { id: "quotesWon", header: "quotes_won", labelKey: "quotesWon", kind: "number" },
  {
    id: "conversion",
    header: "conversion_rate",
    labelKey: "conversionRate",
    kind: "percent",
  },
  {
    id: "outstanding",
    header: "outstanding_amount",
    labelKey: "outstanding",
    kind: "money",
  },
];

export function buildSalesExportDataset(
  rows: SalesPerformanceRow[],
  range: DateRange,
  currency: string,
): CanonicalExportDataset {
  return {
    id: "sales-performance",
    filename: `compte-sales-performance-${yearStamp(range)}.csv`,
    columns: salesColumns,
    rows: rows.map((row) => [
      row.salespersonName,
      currency,
      centsToCsvEuro(row.revenueCents),
      row.quotesCreated,
      row.quotesWon,
      row.conversionRate === null ? "" : (row.conversionRate * 100).toFixed(2),
      centsToCsvEuro(row.outstandingCents),
    ]),
  };
}

const productColumns: ExportColumnDef[] = [
  {
    id: "productCode",
    header: "product_code",
    labelKey: "productCode",
    kind: "text",
    searchable: true,
  },
  {
    id: "productName",
    header: "product_name",
    labelKey: "productName",
    kind: "text",
    searchable: true,
  },
  { id: "type", header: "type", labelKey: "type", kind: "text", searchable: true },
  { id: "unit", header: "unit", labelKey: "unit", kind: "text" },
  { id: "quantity", header: "quantity_or_usage", labelKey: "usage", kind: "number" },
  { id: "currency", header: "currency", labelKey: "currency", kind: "text" },
  { id: "revenue", header: "revenue", labelKey: "revenue", kind: "money" },
  { id: "avgPrice", header: "average_price", labelKey: "averagePrice", kind: "money" },
  { id: "cost", header: "cost", labelKey: "cost", kind: "money" },
  { id: "margin", header: "gross_margin", labelKey: "grossMargin", kind: "money" },
];

export function buildProductExportDataset(
  rows: ProductPerformanceRow[],
  range: DateRange,
  currency: string,
): CanonicalExportDataset {
  return {
    id: "product-performance",
    filename: `compte-product-performance-${yearStamp(range)}.csv`,
    columns: productColumns,
    rows: rows.map((row) => [
      row.productCode,
      row.productName,
      row.type,
      row.unit,
      row.quantity,
      currency,
      centsToCsvEuro(row.revenueCents),
      centsToCsvEuro(row.averagePriceCents),
      row.costCents === null ? "" : centsToCsvEuro(row.costCents),
      row.marginCents === null ? "" : centsToCsvEuro(row.marginCents),
    ]),
  };
}
