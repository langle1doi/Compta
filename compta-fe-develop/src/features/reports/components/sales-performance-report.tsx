"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { ReportTableScroll } from "@/components/compte/report-table-scroll";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";

import type { ExportResult } from "../export";
import { exportSalesCsv } from "../export";
import type { DateRange, SalesPerformanceRow } from "../model";
import { ReportCard } from "./report-card";
import { ReportExportButton } from "./report-export-button";

type SortKey = "revenue" | "quotesWon" | "conversion" | "outstanding";

const RANK_MEDALS = [
  "/reports/rank-1-gold.png",
  "/reports/rank-2-silver.png",
  "/reports/rank-3-bronze.png",
] as const;

function RankBadge({ rank }: { rank: number }) {
  const medalSrc = RANK_MEDALS[rank - 1];
  if (medalSrc) {
    return (
      <span
        aria-hidden="true"
        className="relative grid h-9 w-9 shrink-0 place-items-center sm:h-10 sm:w-10"
      >
        <Image
          alt=""
          className="h-9 w-9 object-contain sm:h-10 sm:w-10"
          height={40}
          src={medalSrc}
          width={40}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef2f7] text-[12px] font-semibold text-[#66758d] tabular-nums sm:h-9 sm:w-9 sm:text-[13px]"
    >
      {rank}
    </span>
  );
}

export function SalesPerformanceReport({
  rows,
  range,
  currency,
  onEmptyExport,
  className,
}: {
  rows: SalesPerformanceRow[];
  range: DateRange;
  currency: string;
  onEmptyExport: () => void;
  className?: string;
}) {
  const t = useTranslations("reports");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");

  const sorted = useMemo(() => {
    return [...rows].sort((left, right) => {
      if (sortKey === "conversion") {
        return (right.conversionRate ?? -1) - (left.conversionRate ?? -1);
      }
      if (sortKey === "quotesWon") return right.quotesWon - left.quotesWon;
      if (sortKey === "outstanding") return right.outstandingCents - left.outstandingCents;
      return right.revenueCents - left.revenueCents;
    });
  }, [rows, sortKey]);

  function handleExport(): ExportResult {
    const result = exportSalesCsv(rows, range, currency);
    if (!result.ok) onEmptyExport();
    return result;
  }

  return (
    <ReportCard
      className={className}
      title={t("sales.title")}
      subtitle={t("sales.subtitle")}
      empty={rows.length === 0}
      emptyTitle={t("empty.reportTitle")}
      emptyBody={t("empty.reportBody")}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      action={
        <ReportExportButton
          generatingLabel={t("export.generating")}
          label={t("export.csv")}
          onExport={handleExport}
        />
      }
    >
      <ReportTableScroll
        className="h-full min-h-0 flex-1"
        maxHeightClassName="max-h-[280px] sm:max-h-[320px] xl:max-h-none"
      >
        <table className="w-full min-w-[520px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-[1] bg-[#f8fafc]/96 text-[10px] font-semibold tracking-wide text-[#7d8aa0] uppercase backdrop-blur-sm">
            <tr>
              <th className="px-3 py-2.5 sm:px-3.5">{t("sales.columns.salesperson")}</th>
              {(
                [
                  ["revenue", "revenue"],
                  ["quotesWon", "quotesWon"],
                  ["conversion", "conversion"],
                  ["outstanding", "outstanding"],
                ] as const
              ).map(([key, labelKey]) => (
                <th className="px-3 py-2.5 text-right sm:px-3.5" key={key}>
                  <button
                    className="font-semibold tracking-wide uppercase hover:text-[var(--dashboard-link)]"
                    type="button"
                    onClick={() => setSortKey(key)}
                  >
                    {t(`sales.columns.${labelKey}`)}
                    {sortKey === key ? " ·" : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => (
              <tr className="border-t border-[rgb(220_229_239/0.7)]" key={row.salespersonId}>
                <td className="h-12 px-3 py-2 sm:h-14 sm:px-3.5 sm:py-2.5">
                  <span className="inline-flex min-w-0 items-center gap-2.5">
                    <RankBadge rank={index + 1} />
                    <span
                      className="truncate text-[12px] font-semibold text-[#24334c] sm:text-[13px]"
                      title={row.salespersonName}
                    >
                      {row.salespersonName}
                    </span>
                  </span>
                </td>
                <td className="h-12 px-3 py-2 text-right text-[12px] font-semibold text-[#132642] tabular-nums sm:h-14 sm:px-3.5 sm:py-2.5 sm:text-[13px]">
                  {formatMoneyFromCents(row.revenueCents)}
                </td>
                <td className="h-12 px-3 py-2 text-right text-[12px] text-[#516078] tabular-nums sm:h-14 sm:px-3.5 sm:py-2.5 sm:text-[13px]">
                  {row.quotesWon}
                </td>
                <td className="h-12 px-3 py-2 text-right text-[12px] text-[#516078] tabular-nums sm:h-14 sm:px-3.5 sm:py-2.5 sm:text-[13px]">
                  {row.conversionRate === null ? "—" : formatPercent(row.conversionRate)}
                </td>
                <td className="h-12 px-3 py-2 text-right text-[12px] font-semibold text-[#132642] tabular-nums sm:h-14 sm:px-3.5 sm:py-2.5 sm:text-[13px]">
                  {formatMoneyFromCents(row.outstandingCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportTableScroll>
    </ReportCard>
  );
}
