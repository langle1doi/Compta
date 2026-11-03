"use client";

import { useNestedScrollChain } from "@/lib/use-nested-scroll-chain";

import { useRef } from "react";
import { useTranslations } from "next-intl";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";

const BREAKDOWN_TABS_LAYOUT_ID = "compte-reports-breakdown-tabs";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

import { reportChart } from "../chart-palette";
import type { ExportResult } from "../export";
import { exportBreakdownCsv } from "../export";
import type { DateRange, RevenueBreakdownDimension, RevenueBreakdownRow } from "../model";
import { ReportCard } from "./report-card";
import { ReportExportButton } from "./report-export-button";

export const BREAKDOWN_DIMENSIONS: RevenueBreakdownDimension[] = [
  "customer",
  "salesperson",
  "product",
  "company",
];

export function RevenueBreakdownReport({
  rows,
  totalCents,
  dimension,
  dimensions,
  range,
  currency,
  onDimensionChange,
  onEmptyExport,
}: {
  rows: RevenueBreakdownRow[];
  totalCents: number;
  dimension: RevenueBreakdownDimension;
  dimensions: RevenueBreakdownDimension[];
  range: DateRange;
  currency: string;
  onDimensionChange: (value: RevenueBreakdownDimension) => void;
  onEmptyExport: () => void;
}) {
  const t = useTranslations("reports");
  const listScrollRef = useRef<HTMLUListElement>(null);
  useNestedScrollChain(listScrollRef);
  const max = Math.max(...rows.map((row) => row.revenueCents), 1);

  function handleExport(): ExportResult {
    const result = exportBreakdownCsv(rows, dimension, range, currency);
    if (!result.ok) onEmptyExport();
    return result;
  }

  return (
    <ReportCard
      className="h-full"
      title={t("breakdown.title")}
      subtitle={t("breakdown.subtitle")}
      empty={rows.length === 0 || totalCents === 0}
      emptyTitle={t("empty.reportTitle")}
      emptyBody={t("empty.reportBody")}
      action={
        <ReportExportButton
          generatingLabel={t("export.generating")}
          label={t("export.csv")}
          onExport={handleExport}
        />
      }
      bodyClassName="gap-2"
    >
      <AnimatedSelectionGroup
        className="flex shrink-0 flex-wrap gap-0.5 rounded-[9px] bg-[var(--dashboard-soft-blue)]/60 p-0.5"
        id="compte-reports-breakdown"
      >
        {dimensions.map((item) => {
          const active = item === dimension;
          return (
            <button
              key={item}
              className={cn(
                "relative rounded-[7px] px-2 py-1 text-[11px] font-semibold transition-colors",
                active ? "text-[var(--dashboard-link)]" : "text-[#66758d]",
              )}
              type="button"
              onClick={() => onDimensionChange(item)}
            >
              {active ? (
                <AnimatedActiveIndicator
                  borderRadius={7}
                  className="absolute inset-0 rounded-[7px] border border-[rgb(59_130_246/0.18)] bg-white shadow-[var(--shadow-mini)]"
                  layoutId={BREAKDOWN_TABS_LAYOUT_ID}
                  variant="soft-pill"
                />
              ) : null}
              <span className="relative z-[1]">{t(`breakdown.${item}`)}</span>
            </button>
          );
        })}
      </AnimatedSelectionGroup>

      <ul ref={listScrollRef} className="dashboard-scroll--chain flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {rows.map((row, index) => (
          <li className="min-w-0" key={row.id}>
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[12px] font-semibold text-[#24334c]">
                <span className="mr-1.5 text-[#98a4b5] tabular-nums">{index + 1}</span>
                {row.id === "__other__" ? t("breakdown.other") : row.label}
              </p>
              <div className="shrink-0 text-right">
                <p className="text-[12px] font-semibold text-[#132642] tabular-nums">
                  {formatMoneyFromCents(row.revenueCents)}
                </p>
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
                  width: `${Math.max(3, (row.revenueCents / max) * 100)}%`,
                  backgroundColor: reportChart.current,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="shrink-0 text-[11px] text-[#98a4b5] tabular-nums">
        {t("breakdown.topNote", { total: formatMoneyFromCents(totalCents) })}
      </p>
    </ReportCard>
  );
}
