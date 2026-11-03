"use client";

import {
  ChartNoAxesCombined,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  Funnel,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { IconTile } from "@/components/dashboard/tone";
import type { Tone } from "@/mocks/dashboard/types";

import {
  buildAgingExportDataset,
  buildPipelineExportDataset,
  buildProductExportDataset,
  buildRevenueExportDataset,
  buildSalesExportDataset,
  downloadCanonicalDataset,
  type CanonicalExportDataset,
  type PipelineQuoteExportRow,
  type ReportExportId,
} from "../export-dataset";
import type {
  AgingDetailRow,
  DateRange,
  ProductPerformanceRow,
  RevenuePoint,
  SalesPerformanceRow,
} from "../model";
import { ReportPreviewSheet } from "./report-preview-sheet";

type ExportCardConfig = {
  id: ReportExportId;
  icon: LucideIcon;
  tone: Tone;
  metaPrimary: string;
  metaSecondary: string;
  deferred?: boolean;
};

/** Column count per visible card count, so cards hidden by permission leave no hole. */
const LIBRARY_GRID: Record<number, string> = {
  4: "sm:grid-cols-2 xl:grid-cols-4",
  5: "sm:grid-cols-2 xl:grid-cols-3 sm:[&>*:last-child]:col-span-2",
  6: "sm:grid-cols-2 xl:grid-cols-3",
};

export function ExportsAccountingSection({
  currency,
  range,
  trend,
  agingDetails,
  pipelineQuotes,
  sales,
  products,
  canExport,
  canExportFec,
  canViewBySales,
  filterSummary,
  onEmptyExport,
  onExported,
}: {
  currency: string;
  range: DateRange;
  trend: RevenuePoint[];
  agingDetails: AgingDetailRow[];
  pipelineQuotes: PipelineQuoteExportRow[];
  sales: SalesPerformanceRow[];
  products: ProductPerformanceRow[];
  canExport: boolean;
  canExportFec: boolean;
  canViewBySales: boolean;
  filterSummary?: string;
  onEmptyExport: () => void;
  onExported?: () => void;
}) {
  const t = useTranslations("reports.library");
  const previewT = useTranslations("reports.preview");
  const exportT = useTranslations("reports.export");
  const [previewId, setPreviewId] = useState<ReportExportId | null>(null);

  const datasets = useMemo(() => {
    const asOf = new Date().toISOString().slice(0, 10);
    return {
      revenue: buildRevenueExportDataset(trend, range, currency),
      "receivables-aging": buildAgingExportDataset(agingDetails, asOf),
      "quote-pipeline": buildPipelineExportDataset(pipelineQuotes, range),
      "sales-performance": buildSalesExportDataset(sales, range, currency),
      "product-performance": buildProductExportDataset(products, range, currency),
    } satisfies Partial<Record<ReportExportId, CanonicalExportDataset>>;
  }, [agingDetails, currency, pipelineQuotes, products, range, sales, trend]);

  const cards: ExportCardConfig[] = [
    {
      id: "revenue",
      icon: ChartNoAxesCombined,
      tone: "blue",
      metaPrimary: "CSV",
      metaSecondary: t("meta.byPeriod"),
    },
    {
      id: "receivables-aging",
      icon: Coins,
      tone: "orange",
      metaPrimary: "CSV",
      metaSecondary: t("meta.byInvoice"),
    },
    {
      id: "quote-pipeline",
      icon: Funnel,
      tone: "green",
      metaPrimary: "CSV",
      metaSecondary: t("meta.byQuote"),
    },
    {
      id: "sales-performance",
      icon: Users,
      tone: "purple",
      metaPrimary: "CSV",
      metaSecondary: t("meta.bySalesperson"),
    },
    {
      id: "product-performance",
      icon: Package,
      tone: "slate",
      metaPrimary: "CSV",
      metaSecondary: t("meta.byProduct"),
    },
    {
      id: "fec",
      icon: FileSpreadsheet,
      tone: "red",
      metaPrimary: "FEC",
      metaSecondary: t("meta.specialExport"),
      deferred: true,
    },
  ];

  // The FEC card has nothing but an export; the sales card compares colleagues.
  const visibleCards = cards.filter((card) => {
    if (card.id === "fec") return canExportFec;
    if (card.id === "sales-performance") return canViewBySales;
    return true;
  });

  const i18nKey = (id: ReportExportId) => {
    switch (id) {
      case "revenue":
        return "revenue";
      case "receivables-aging":
        return "aging";
      case "quote-pipeline":
        return "pipeline";
      case "sales-performance":
        return "sales";
      case "product-performance":
        return "products";
      case "fec":
        return "fec";
    }
  };

  function runExport(id: Exclude<ReportExportId, "fec">) {
    if (!canExport) return;
    const dataset = datasets[id];
    if (!dataset) return;
    const result = downloadCanonicalDataset(dataset);
    if (!result.ok) onEmptyExport();
    else onExported?.();
  }

  const activeDataset =
    previewId && previewId !== "fec" ? (datasets[previewId] ?? null) : null;
  const activeCard = cards.find((card) => card.id === previewId);
  const ActiveIcon = activeCard?.icon ?? ChartNoAxesCombined;

  return (
    <>
      <section className="dashboard-card shrink-0 overflow-hidden">
        <div className="border-b border-[#edf2f8] px-3 py-2.5">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#063586] sm:text-sm">
            {t("title")}
          </h2>
          <p className="mt-0.5 text-[11px] text-[#7d8aa0]">{t("subtitle")}</p>
        </div>

        <div className={`grid grid-cols-1 gap-2 p-2.5 ${LIBRARY_GRID[visibleCards.length]}`}>
          {visibleCards.map((card) => {
            const key = i18nKey(card.id);
            return (
              <article
                className="flex min-w-0 flex-col gap-2 rounded-[10px] border border-[#edf2f8] bg-[#fbfcfe] px-2.5 py-2.5"
                key={card.id}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <IconTile icon={card.icon} size="xs" tone={card.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-[#24334c]">
                      {t(`${key}.title`)}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#98a4b5]">
                      {t(`${key}.body`)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 pt-0.5">
                    <span className="rounded-[6px] bg-[#eef3fb] px-1.5 py-0.5 text-[9px] font-semibold text-[#044ce2]">
                      {card.metaPrimary}
                    </span>
                    <span className="rounded-[6px] bg-[#f3f5f9] px-1.5 py-0.5 text-[9px] font-semibold text-[#7d8aa0]">
                      {card.metaSecondary}
                    </span>
                  </div>
                </div>

                <div className="mt-auto flex min-h-8 flex-wrap items-center gap-1.5">
                  {card.deferred ? (
                    <span className="inline-flex h-8 items-center rounded-[8px] bg-[#fff6eb] px-2 text-[10px] font-semibold text-[#b96d24]">
                      {t("fec.badge")}
                    </span>
                  ) : (
                    <>
                      <button
                        aria-label={previewT("viewAria", { report: t(`${key}.title`) })}
                        className="action-motion soft-button inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[10px] font-semibold text-[#516078]"
                        type="button"
                        onClick={() => setPreviewId(card.id)}
                      >
                        <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                        {previewT("view")}
                      </button>
                      {canExport ? (
                        <button
                          aria-label={previewT("exportAria", { report: t(`${key}.title`) })}
                          className="action-motion inline-flex h-8 items-center gap-1 rounded-[8px] bg-[#e8efff] px-2 text-[10px] font-semibold text-[#044ce2] hover:bg-[#dce7ff]"
                          type="button"
                          onClick={() => runExport(card.id as Exclude<ReportExportId, "fec">)}
                        >
                          <Download aria-hidden="true" className="h-3.5 w-3.5" />
                          {exportT("csv")}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <p className="border-t border-[#edf2f8] px-3 py-1.5 text-[10px] text-[#98a4b5]">
          {t("excelNote")}
        </p>
      </section>

      <ReportPreviewSheet
        canExport={canExport}
        dataset={activeDataset}
        description={previewT("subtitle")}
        filterSummary={filterSummary}
        icon={
          <IconTile
            icon={ActiveIcon}
            size="sm"
            tone={activeCard?.tone ?? "blue"}
          />
        }
        open={previewId !== null && previewId !== "fec"}
        title={
          previewId && previewId !== "fec"
            ? previewT("title", { report: t(`${i18nKey(previewId)}.title`) })
            : previewT("fallbackTitle")
        }
        onClose={() => setPreviewId(null)}
        onEmptyExport={onEmptyExport}
        onExported={onExported}
      />
    </>
  );
}
