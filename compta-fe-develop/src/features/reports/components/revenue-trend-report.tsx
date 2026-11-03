"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { SoftSelect } from "@/components/compte/soft-select";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";

import type { ExportResult } from "../export";
import { exportRevenueTrendCsv } from "../export";
import type { DateRange, ReportGranularity, ReportTrendMetric, RevenuePoint } from "../model";
import { withRevenueTrendChartDemo } from "../revenue-trend-chart-demo";
import { ReportCard } from "./report-card";
import { ReportExportButton } from "./report-export-button";

const RevenueTrendChart = dynamic(
  () => import("./revenue-trend-chart").then((mod) => mod.RevenueTrendChart),
  {
    ssr: false,
    loading: () => <div className="loading-shimmer h-full w-full rounded-[12px]" />,
  },
);

export function RevenueTrendReport({
  points,
  range,
  currency,
  granularity,
  metric,
  onGranularityChange,
  onMetricChange,
  onEmptyExport,
}: {
  points: RevenuePoint[];
  range: DateRange;
  currency: string;
  granularity: ReportGranularity;
  metric: ReportTrendMetric;
  onGranularityChange: (value: ReportGranularity) => void;
  onMetricChange: (value: ReportTrendMetric) => void;
  onEmptyExport: () => void;
}) {
  const t = useTranslations("reports");
  const { points: chartPoints, usedDemo } = useMemo(
    () => withRevenueTrendChartDemo(points, granularity),
    [points, granularity],
  );
  const empty = chartPoints.every(
    (point) => point.revenueCents === 0 && point.previousRevenueCents === 0,
  );

  function handleExport(): ExportResult {
    const result = exportRevenueTrendCsv(points, range, currency);
    if (!result.ok) onEmptyExport();
    return result;
  }

  return (
    <ReportCard
      className="h-full"
      title={t("revenueTrend.title")}
      subtitle={t("revenueTrend.subtitle")}
      empty={empty}
      emptyTitle={t("empty.reportTitle")}
      emptyBody={t("empty.reportBody")}
      action={
        <>
          <SoftSelect
            className="w-[7.25rem]"
            hideLabel
            label={t("revenueTrend.granularity")}
            options={[
              { value: "monthly", label: t("revenueTrend.monthly") },
              { value: "quarterly", label: t("revenueTrend.quarterly") },
              { value: "yearly", label: t("revenueTrend.yearly") },
            ]}
            triggerClassName="font-semibold text-[#405069]"
            value={granularity}
            onChange={(value) => onGranularityChange(value as ReportGranularity)}
          />
          <SoftSelect
            className="w-[6.5rem]"
            hideLabel
            label={t("revenueTrend.metric")}
            options={[
              { value: "revenue", label: t("revenueTrend.metricRevenue") },
              { value: "margin", label: t("revenueTrend.metricMargin") },
            ]}
            triggerClassName="font-semibold text-[#405069]"
            value={metric}
            onChange={(value) => onMetricChange(value as ReportTrendMetric)}
          />
          <ReportExportButton
            generatingLabel={t("export.generating")}
            label={t("export.csv")}
            onExport={handleExport}
          />
        </>
      }
    >
      <div className="h-[250px] w-full min-w-0 shrink-0 overflow-visible sm:h-[290px] xl:h-[310px]">
        <RevenueTrendChart
          labels={{
            current: t("revenueTrend.current"),
            previous: t("revenueTrend.previous"),
            marginPct: t("revenueTrend.marginPct"),
            period: t("filters.period"),
          }}
          metric={metric}
          points={chartPoints}
        />
      </div>
      {usedDemo ? (
        <p className="mt-2 shrink-0 text-[10px] leading-4 text-[#98a4b5]">
          {t("revenueTrend.chartDemoNote")}
        </p>
      ) : null}
      <p className="mt-2 shrink-0 text-[11px] text-[#8a97ab] tabular-nums">
        {t("revenueTrend.summary", {
          current: formatMoneyFromCents(
            points.reduce((sum, point) => sum + point.revenueCents, 0),
          ),
          previous: formatMoneyFromCents(
            points.reduce((sum, point) => sum + point.previousRevenueCents, 0),
          ),
          margin: points.some((point) => point.marginPercent !== null)
            ? formatPercent(
                points.reduce((sum, point) => sum + (point.marginPercent ?? 0), 0) /
                  Math.max(1, points.filter((point) => point.marginPercent !== null).length),
              )
            : t("kpis.unavailable"),
        })}
      </p>
    </ReportCard>
  );
}
