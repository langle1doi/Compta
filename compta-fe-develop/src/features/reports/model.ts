export type ReportPeriodPreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "previous_year";

export type ReportGranularity = "monthly" | "quarterly" | "yearly";

export type ReportTrendMetric = "revenue" | "margin";

export type RevenueBreakdownDimension = "customer" | "salesperson" | "product" | "company";

export type PipelineMetric = "count" | "value";

export type AgingBucketId = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

export type ReportFilters = {
  period: ReportPeriodPreset;
  /** null = current shell company only; "all" = every company in scope */
  companyId: string | "all" | null;
  currency: string;
  salespersonId: string | null;
  customerId: string | null;
  productId: string | null;
  quoteStatus: string | null;
  invoiceStatus: string | null;
};

export const emptyReportFilters: ReportFilters = {
  /** Seed ledger is mid-October; year-to-date shows coherent invoiced history. */
  period: "this_year",
  companyId: null,
  currency: "EUR",
  salespersonId: null,
  customerId: null,
  productId: null,
  quoteStatus: null,
  invoiceStatus: null,
};

export type DateRange = {
  start: string;
  end: string;
  labelKey: string;
};

export type RevenuePoint = {
  key: string;
  label: string;
  revenueCents: number;
  previousRevenueCents: number;
  marginCents: number | null;
  marginPercent: number | null;
};

export type RevenueBreakdownRow = {
  id: string;
  label: string;
  revenueCents: number;
  sharePercent: number;
};

export type AgingBucket = {
  id: AgingBucketId;
  amountCents: number;
  sharePercent: number;
  invoiceIds: string[];
};

export type AgingDetailRow = {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  agingBucket: AgingBucketId;
  invoiceTotalCents: number;
  paidCents: number;
  remainingCents: number;
  currency: string;
};

export type QuotePipelineRow = {
  status: string;
  count: number;
  valueCents: number;
  sharePercent: number;
};

export type SalesPerformanceRow = {
  salespersonId: string;
  salespersonName: string;
  revenueCents: number;
  quotesCreated: number;
  quotesWon: number;
  conversionRate: number | null;
  outstandingCents: number;
};

export type ProductPerformanceRow = {
  productId: string;
  productCode: string;
  productName: string;
  type: string;
  unit: string;
  quantity: number;
  revenueCents: number;
  averagePriceCents: number;
  costCents: number | null;
  marginCents: number | null;
};

export type ReportKpis = {
  revenueCents: number;
  revenueDeltaRatio: number | null;
  marginCents: number | null;
  marginPercent: number | null;
  marginDeltaRatio: number | null;
  marginAvailable: boolean;
  outstandingCents: number;
  outstandingDeltaRatio: number | null;
  conversionRate: number | null;
  conversionDeltaRatio: number | null;
};
