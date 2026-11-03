"use client";

import { useTranslations } from "next-intl";

import { SoftSelect } from "@/components/compte/soft-select";
import { quoteStatusColor } from "@/features/quotes/status";
import { useCan } from "@/features/settings/can";
import type { QuoteStatus } from "@/features/quotes/model";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";
import { Link } from "@/i18n/navigation";

import type { ExportResult } from "../export";
import { exportPipelineCsv } from "../export";
import type { DateRange, PipelineMetric, QuotePipelineRow } from "../model";
import { ReportCard } from "./report-card";
import { ReportExportButton } from "./report-export-button";

export function QuotePipelineReport({
  rows,
  metric,
  range,
  pipelineQuotes,
  onMetricChange,
  onEmptyExport,
}: {
  rows: QuotePipelineRow[];
  metric: PipelineMetric;
  range: DateRange;
  pipelineQuotes: Array<{
    id: string;
    customerName: string;
    salespersonName: string;
    createdAt: string;
    validUntil: string;
    status: string;
    htCents: number;
    ttcCents: number;
    currency: string;
  }>;
  onMetricChange: (value: PipelineMetric) => void;
  onEmptyExport: () => void;
}) {
  const t = useTranslations("reports");
  const canOpenQuotes = useCan()("quote.read");
  const empty = rows.every((row) => row.count === 0);
  const max = Math.max(
    ...rows.map((row) => (metric === "count" ? row.count : row.valueCents)),
    1,
  );

  function handleExport(): ExportResult {
    const result = exportPipelineCsv(pipelineQuotes, range);
    if (!result.ok) onEmptyExport();
    return result;
  }

  return (
    <ReportCard
      title={t("pipeline.title")}
      subtitle={t("pipeline.subtitle")}
      empty={empty}
      emptyTitle={t("empty.reportTitle")}
      emptyBody={t("empty.reportBody")}
      action={
        <>
          <SoftSelect
            className="w-[6.25rem]"
            hideLabel
            label={t("pipeline.metric")}
            options={[
              { value: "count", label: t("pipeline.count") },
              { value: "value", label: t("pipeline.value") },
            ]}
            triggerClassName="font-semibold text-[#405069]"
            value={metric}
            onChange={(value) => onMetricChange(value as PipelineMetric)}
          />
          <ReportExportButton
            generatingLabel={t("export.generating")}
            label={t("export.csv")}
            onExport={handleExport}
          />
        </>
      }
    >
      <ul className="flex min-h-0 flex-col gap-1.5">
        {rows.map((row) => {
          const status = row.status as QuoteStatus;
          const value = metric === "count" ? row.count : row.valueCents;
          const display =
            metric === "count"
              ? String(row.count)
              : formatMoneyFromCents(row.valueCents);
          return (
            <li className="min-w-0" key={row.status}>
              <div className="mb-0.5 flex items-center justify-between gap-2">
                {canOpenQuotes ? (
                  <Link
                    className="text-[12px] font-semibold text-[#24334c] hover:text-[var(--dashboard-link)]"
                    href="/devis"
                  >
                    {t(`quoteStatus.${status}`)}
                  </Link>
                ) : (
                  <span className="text-[12px] font-semibold text-[#24334c]">
                    {t(`quoteStatus.${status}`)}
                  </span>
                )}
                <div className="flex items-baseline gap-2 text-right">
                  <p className="text-[12px] font-semibold text-[#132642] tabular-nums">{display}</p>
                  <p className="text-[11px] text-[#98a4b5] tabular-nums">
                    {formatPercent(row.sharePercent)}
                  </p>
                </div>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--report-chart-track)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(3, (value / max) * 100)}%`,
                    backgroundColor: quoteStatusColor[status],
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </ReportCard>
  );
}
