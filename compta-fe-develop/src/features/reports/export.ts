import {
  buildAgingExportDataset,
  buildBreakdownExportDataset,
  buildPipelineExportDataset,
  buildProductExportDataset,
  buildRevenueExportDataset,
  buildSalesExportDataset,
  downloadCanonicalDataset,
  type ExportResult,
  type PipelineQuoteExportRow,
} from "./export-dataset";
import type {
  AgingDetailRow,
  DateRange,
  ProductPerformanceRow,
  QuotePipelineRow,
  RevenueBreakdownRow,
  RevenuePoint,
  SalesPerformanceRow,
} from "./model";
import { filenamePeriodStamp } from "./period";
import { centsToCsvEuro, downloadCsv } from "@/lib/csv-export";

export type { ExportResult } from "./export-dataset";
export {
  buildAgingExportDataset,
  buildBreakdownExportDataset,
  buildPipelineExportDataset,
  buildProductExportDataset,
  buildRevenueExportDataset,
  buildSalesExportDataset,
  downloadCanonicalDataset,
} from "./export-dataset";

function stamp(range: DateRange, extra?: string) {
  const base = filenamePeriodStamp(range);
  return extra ? `${base}-${extra}` : base;
}

export function exportRevenueTrendCsv(
  points: RevenuePoint[],
  range: DateRange,
  currency: string,
): ExportResult {
  return downloadCanonicalDataset(buildRevenueExportDataset(points, range, currency));
}

export function exportBreakdownCsv(
  rows: RevenueBreakdownRow[],
  dimension: string,
  range: DateRange,
  currency: string,
): ExportResult {
  return downloadCanonicalDataset(
    buildBreakdownExportDataset(rows, dimension, range, currency),
  );
}

export function exportAgingCsv(rows: AgingDetailRow[], asOf: string): ExportResult {
  return downloadCanonicalDataset(buildAgingExportDataset(rows, asOf));
}

export function exportPipelineCsv(
  quotes: PipelineQuoteExportRow[],
  range: DateRange,
): ExportResult {
  return downloadCanonicalDataset(buildPipelineExportDataset(quotes, range));
}

export function exportPipelineSummaryCsv(
  rows: QuotePipelineRow[],
  range: DateRange,
  metric: "count" | "value",
): ExportResult {
  if (rows.every((row) => row.count === 0)) return { ok: false, reason: "empty" };
  downloadCsv(
    `compte-quote-pipeline-summary-${stamp(range)}.csv`,
    ["status", "count", "value", "share_percent", "metric"],
    rows.map((row) => [
      row.status,
      row.count,
      centsToCsvEuro(row.valueCents),
      (row.sharePercent * 100).toFixed(2),
      metric,
    ]),
  );
  return { ok: true, rowCount: rows.length };
}

export function exportSalesCsv(
  rows: SalesPerformanceRow[],
  range: DateRange,
  currency: string,
): ExportResult {
  return downloadCanonicalDataset(buildSalesExportDataset(rows, range, currency));
}

export function exportProductCsv(
  rows: ProductPerformanceRow[],
  range: DateRange,
  currency: string,
): ExportResult {
  return downloadCanonicalDataset(buildProductExportDataset(rows, range, currency));
}
