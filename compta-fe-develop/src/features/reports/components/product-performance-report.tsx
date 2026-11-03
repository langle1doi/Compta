"use client";

import { Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { ReportTableScroll } from "@/components/compte/report-table-scroll";
import { IconTile } from "@/components/dashboard/tone";
import { formatMoneyFromCents } from "@/lib/money";

import type { ExportResult } from "../export";
import { exportProductCsv } from "../export";
import type { DateRange, ProductPerformanceRow } from "../model";
import { ReportCard } from "./report-card";
import { ReportExportButton } from "./report-export-button";

function ProductIdentity({ name, code }: { name: string; code: string }) {
  const tooltipId = useId();
  const [position, setPosition] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);

  useEffect(() => {
    if (!position) return;
    const hide = () => setPosition(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [position]);

  function show(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    const above = rect.top > 100;
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: above ? rect.top - 8 : rect.bottom + 8,
      width,
      above,
    });
  }

  return (
    <button
      aria-describedby={position ? tooltipId : undefined}
      aria-label={name}
      className={`relative inline-block min-w-0 max-w-full border-0 bg-transparent pt-[16.5px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#044ce2]/40 ${code === "—" ? "w-20" : ""}`}
      type="button"
      onClick={(event) => show(event.currentTarget)}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={() => setPosition(null)}
      onKeyDown={(event) => { if (event.key === "Escape") setPosition(null); }}
    >
      <span className="absolute inset-x-0 top-0 truncate font-semibold leading-[16.5px] text-[#24334c]">{name}</span>
      <span className="block truncate text-[10px] leading-[15px] text-[#98a4b5]">{code}</span>
      {position ? createPortal(
        <span
          className="pointer-events-none fixed z-[120] w-max rounded-lg bg-[#14233f] px-3 py-2 text-xs leading-5 break-words whitespace-normal text-white shadow-lg"
          id={tooltipId}
          role="tooltip"
          style={{ left: position.left, top: position.top, maxWidth: position.width, transform: position.above ? "translateY(-100%)" : undefined }}
        >{name}</span>,
        document.body,
      ) : null}
    </button>
  );
}

export function ProductPerformanceReport({
  rows,
  range,
  currency,
  onEmptyExport,
  className,
}: {
  rows: ProductPerformanceRow[];
  range: DateRange;
  currency: string;
  onEmptyExport: () => void;
  className?: string;
}) {
  const t = useTranslations("reports");
  const showMargin = rows.some((row) => row.marginCents !== null);

  function handleExport(): ExportResult {
    const result = exportProductCsv(rows, range, currency);
    if (!result.ok) onEmptyExport();
    return result;
  }

  return (
    <ReportCard
      className={className}
      title={t("products.title")}
      subtitle={t("products.subtitle")}
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
        <table className={`w-full table-fixed border-collapse text-left text-[11px] ${showMargin ? "min-w-[624px]" : "min-w-[512px]"}`}>
          <colgroup>
            <col className="w-[128px]" />
            <col className="w-[72px]" />
            <col className="w-[112px]" />
            <col className="w-[88px]" />
            <col className="w-[112px]" />
            {showMargin ? <col className="w-[112px]" /> : null}
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-[#f8fafc]/96 text-[10px] font-semibold tracking-wide text-[#7d8aa0] uppercase backdrop-blur-sm">
            <tr>
              <th className="px-3 py-1.5">{t("products.columns.product")}</th>
              <th className="px-3 py-1.5 text-center">{t("products.columns.type")}</th>
              <th className="px-3 py-1.5 text-right">{t("products.columns.revenue")}</th>
              <th className="px-3 py-1.5 text-right">{t("products.columns.usage")}</th>
              <th className="px-3 py-1.5 text-right">{t("products.columns.avgPrice")}</th>
              {showMargin ? (
                <th className="px-3 py-1.5 text-right">{t("products.columns.margin")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t border-[rgb(220_229_239/0.7)]" key={row.productId}>
                <td className="px-3 py-1.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <IconTile
                      className="shrink-0"
                      icon={Package}
                      size="xs"
                      strokeWidth={2.1}
                      tone="slate"
                    />
                    <ProductIdentity name={row.productName} code={row.productCode} />
                  </span>
                </td>
                <td className="px-3 py-1.5 text-center">
                  <span className="inline-flex rounded-[5px] bg-[#eef2f7] px-1.5 py-0.5 text-[10px] font-medium text-[#66758d]">
                    {t(`products.types.${row.type}`)}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-semibold text-[#132642] tabular-nums">
                  {formatMoneyFromCents(row.revenueCents)}
                </td>
                <td className="px-3 py-1.5 text-right text-[#516078] tabular-nums">
                  {row.quantity} {row.unit}
                </td>
                <td className="px-3 py-1.5 text-right text-[#516078] tabular-nums">
                  {formatMoneyFromCents(row.averagePriceCents)}
                </td>
                {showMargin ? (
                  <td className="px-3 py-1.5 text-right text-[#132642] tabular-nums">
                    {row.marginCents === null ? "—" : formatMoneyFromCents(row.marginCents)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </ReportTableScroll>
    </ReportCard>
  );
}
