"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { SoftToast } from "@/components/compte/soft-toast";
import { can, useCan } from "@/features/settings/can";
import { usePermissions } from "@/features/settings/session-provider";
import { cn } from "@/lib/utils";

import { hydrateLedger } from "@/features/quotes/store";

import {
  exportAgingCsv,
  exportBreakdownCsv,
  exportPipelineCsv,
  exportProductCsv,
  exportRevenueTrendCsv,
  exportSalesCsv,
} from "./export";
import { ReportExportMenu } from "./components/report-export-menu";
import { ReportsFilterBar } from "./components/reports-filter-bar";
import { ReportsKpiGrid } from "./components/reports-kpi-grid";
import {
  BREAKDOWN_DIMENSIONS,
  RevenueBreakdownReport,
} from "./components/revenue-breakdown-report";
import { RevenueTrendReport } from "./components/revenue-trend-report";
import type {
  AgingBucketId,
  PipelineMetric,
  ReportFilters,
  ReportGranularity,
  ReportTrendMetric,
  RevenueBreakdownDimension,
} from "./model";
import { emptyReportFilters } from "./model";
import { useDerivedReports } from "./use-reports-data";

function ReportSectionSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`dashboard-card loading-shimmer min-h-[240px] w-full rounded-[14px] ${className ?? ""}`}
    />
  );
}

const ReceivableAgingReport = dynamic(
  () =>
    import("./components/receivable-aging-report").then(
      (mod) => mod.ReceivableAgingReport,
    ),
  { loading: () => <ReportSectionSkeleton className="min-h-[280px]" /> },
);

const QuotePipelineReport = dynamic(
  () =>
    import("./components/quote-pipeline-report").then(
      (mod) => mod.QuotePipelineReport,
    ),
  { loading: () => <ReportSectionSkeleton className="min-h-[280px]" /> },
);

const SalesPerformanceReport = dynamic(
  () =>
    import("./components/sales-performance-report").then(
      (mod) => mod.SalesPerformanceReport,
    ),
  { loading: () => <ReportSectionSkeleton className="min-h-[320px] xl:h-full" /> },
);

const ProductPerformanceReport = dynamic(
  () =>
    import("./components/product-performance-report").then(
      (mod) => mod.ProductPerformanceReport,
    ),
  { loading: () => <ReportSectionSkeleton className="min-h-[320px] xl:h-full" /> },
);

const ExportsAccountingSection = dynamic(
  () =>
    import("./components/exports-accounting-section").then(
      (mod) => mod.ExportsAccountingSection,
    ),
  { loading: () => <ReportSectionSkeleton className="min-h-[200px]" /> },
);

export function ReportsWorkspace() {
  const t = useTranslations("reports");
  const activePermissions = usePermissions();
  const check = useCan();
  const canRead = can(activePermissions, "report.read");
  const canExport = can(activePermissions, "report.read");
  const canExportFec = can(activePermissions, "report.export");
  // Comparing salespeople needs more than OWN scope; comparing companies needs the whole tenant.
  const canViewBySales = check("report.read", "COMPANY");
  const canViewAllCompanies = check("report.read", "TENANT");

  const [requestedFilters, setFilters] = useState<ReportFilters>(emptyReportFilters);
  const [granularity, setGranularity] = useState<ReportGranularity>("monthly");
  const [trendMetric, setTrendMetric] = useState<ReportTrendMetric>("revenue");
  const [requestedDimension, setBreakdownDimension] =
    useState<RevenueBreakdownDimension>("customer");
  const [pipelineMetric, setPipelineMetric] = useState<PipelineMetric>("count");
  const [drillBucket, setDrillBucket] = useState<AgingBucketId | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");

  useEffect(() => {
    hydrateLedger();
  }, []);

  // The selections below survive a company switch that narrows the scope, so they are read through it.
  const filters = useMemo<ReportFilters>(
    () => ({
      ...requestedFilters,
      salespersonId: canViewBySales ? requestedFilters.salespersonId : null,
      companyId: canViewAllCompanies ? requestedFilters.companyId : null,
    }),
    [canViewAllCompanies, canViewBySales, requestedFilters],
  );
  const breakdownDimensions = BREAKDOWN_DIMENSIONS.filter((item) => {
    if (item === "salesperson") return canViewBySales;
    if (item === "company") return canViewAllCompanies;
    return true;
  });
  const breakdownDimension = breakdownDimensions.includes(requestedDimension)
    ? requestedDimension
    : "customer";

  const derived = useDerivedReports(filters, {
    granularity,
    breakdownDimension,
    pipelineMetric,
  });

  const currencies = useMemo(() => {
    const set = new Set(derived.raw.companies.map((company) => company.currency));
    set.add("EUR");
    return [...set];
  }, [derived.raw.companies]);

  const filterSummary = useMemo(() => {
    const periodLabel = t(`period.${filters.period}`);
    const companyLabel =
      filters.companyId === "all"
        ? t("filters.allCompanies")
        : derived.raw.companies.find(
            (company) => company.id === (filters.companyId ?? derived.raw.activeCompanyId),
          )?.name ?? t("filters.company");
    const salespersonLabel = filters.salespersonId
      ? (derived.raw.owners.find((owner) => owner.id === filters.salespersonId)?.name ??
        t("filters.salesperson"))
      : t("filters.anySalesperson");
    const customerLabel = filters.customerId
      ? (derived.raw.customers.find((customer) => customer.id === filters.customerId)?.name ??
        t("filters.customer"))
      : t("filters.anyCustomer");
    const productLabel = filters.productId
      ? (derived.raw.products.find((product) => product.id === filters.productId)?.name ??
        t("filters.product"))
      : t("filters.anyProduct");
    return `${periodLabel} · ${companyLabel} · ${filters.currency} · ${salespersonLabel} · ${customerLabel} · ${productLabel}`;
  }, [derived.raw, filters, t]);

  function onEmptyExport() {
    setNoticeTone("info");
    setNotice(t("export.empty"));
  }

  function runExport(fn: () => { ok: boolean }) {
    if (!canExport) {
      setNoticeTone("error");
      setNotice(t("export.forbidden"));
      return;
    }
    const result = fn();
    if (!result.ok) onEmptyExport();
    else {
      setNoticeTone("success");
      setNotice(t("preview.success"));
    }
  }

  if (!canRead) {
    return (
      <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-6">
        <p className="text-sm text-[#7d8aa0]">{t("forbidden")}</p>
      </main>
    );
  }

  const agingTotal = derived.aging.reduce((sum, bucket) => sum + bucket.amountCents, 0);

  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="app-scroll dashboard-page dashboard-stack flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-3" data-scroll-chain-page="true">
        {canExport ? (
          <header className="dashboard-enter enter-0 relative z-20 flex shrink-0 justify-end overflow-visible">
            <ReportExportMenu
              items={[
                {
                  key: "revenue",
                  onSelect: () =>
                    runExport(() =>
                      exportRevenueTrendCsv(derived.trend, derived.range, filters.currency),
                    ),
                },
                {
                  key: "breakdown",
                  onSelect: () =>
                    runExport(() =>
                      exportBreakdownCsv(
                        derived.breakdown.rows,
                        breakdownDimension,
                        derived.range,
                        filters.currency,
                      ),
                    ),
                },
                {
                  key: "aging",
                  onSelect: () =>
                    runExport(() =>
                      exportAgingCsv(
                        derived.agingDetails,
                        new Date().toISOString().slice(0, 10),
                      ),
                    ),
                },
                {
                  key: "pipeline",
                  onSelect: () =>
                    runExport(() =>
                      exportPipelineCsv(derived.pipelineQuotes, derived.range),
                    ),
                },
                {
                  key: "sales",
                  onSelect: () =>
                    runExport(() =>
                      exportSalesCsv(derived.sales, derived.range, filters.currency),
                    ),
                },
                {
                  key: "products",
                  onSelect: () =>
                    runExport(() =>
                      exportProductCsv(derived.products, derived.range, filters.currency),
                    ),
                },
              ].filter((item) => item.key !== "sales" || canViewBySales)}
            />
          </header>
        ) : null}

        <div className="dashboard-enter enter-1 relative z-30 shrink-0">
          <ReportsFilterBar
            activeCompanyId={derived.raw.activeCompanyId}
            canFilterCompany={canViewAllCompanies}
            canFilterSalesperson={canViewBySales}
            companies={derived.raw.companies}
            currencies={currencies}
            customers={derived.raw.customers}
            filters={filters}
            owners={derived.raw.owners}
            products={derived.raw.products.map((product) => ({
              id: product.id,
              name: product.name,
            }))}
            onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onClear={() => setFilters(emptyReportFilters)}
          />
        </div>

        <div className="dashboard-enter enter-2 shrink-0">
          <ReportsKpiGrid kpis={derived.kpis} />
        </div>

        {/* Revenue + Breakdown: shared row stretch so chart fills matched height */}
        <div className="dashboard-enter enter-3 grid min-w-0 grid-cols-1 items-stretch gap-[var(--dashboard-gap)] xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.9fr)] [&>*]:min-w-0">
          <RevenueTrendReport
            currency={filters.currency}
            granularity={granularity}
            metric={trendMetric}
            points={derived.trend}
            range={derived.range}
            onEmptyExport={onEmptyExport}
            onGranularityChange={setGranularity}
            onMetricChange={setTrendMetric}
          />
          <RevenueBreakdownReport
            currency={filters.currency}
            dimension={breakdownDimension}
            dimensions={breakdownDimensions}
            range={derived.range}
            rows={derived.breakdown.rows}
            totalCents={derived.breakdown.totalCents}
            onDimensionChange={setBreakdownDimension}
            onEmptyExport={onEmptyExport}
          />
        </div>

        {/*
          Form-style stretch: Aging | Pipeline stay content-sized, then
          Sales | Products share one fixed row so both cards stretch equally
          and their table scrolls fill to the card foot (no dead white gap).
          Below xl the same cards stack: Aging → Pipeline → Sales → Products.
        */}
        <div className="dashboard-enter enter-4 flex min-w-0 flex-col gap-[var(--dashboard-gap)]">
          <div className="grid min-w-0 grid-cols-1 items-stretch gap-[var(--dashboard-gap)] xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.9fr)]">
            <ReceivableAgingReport
              buckets={derived.aging}
              details={derived.agingDetails}
              drillBucket={drillBucket}
              totalCents={agingTotal}
              onCloseDrill={() => setDrillBucket(null)}
              onDrill={setDrillBucket}
              onEmptyExport={onEmptyExport}
            />
            <QuotePipelineReport
              metric={pipelineMetric}
              pipelineQuotes={derived.pipelineQuotes}
              range={derived.range}
              rows={derived.pipeline}
              onEmptyExport={onEmptyExport}
              onMetricChange={setPipelineMetric}
            />
          </div>
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 items-stretch gap-[var(--dashboard-gap)] xl:h-[520px]",
              canViewBySales && "xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.9fr)]",
            )}
          >
            {canViewBySales ? (
              <div className="relative min-h-0 min-w-0 xl:h-full">
                <div className="flex min-h-0 flex-col xl:absolute xl:inset-0">
                  <SalesPerformanceReport
                    className="min-h-0 xl:h-full"
                    currency={filters.currency}
                    range={derived.range}
                    rows={derived.sales}
                    onEmptyExport={onEmptyExport}
                  />
                </div>
              </div>
            ) : null}
            <div className="relative min-h-0 min-w-0 xl:h-full">
              <div className="flex min-h-0 flex-col xl:absolute xl:inset-0">
                <ProductPerformanceReport
                  className="min-h-0 xl:h-full"
                  currency={filters.currency}
                  range={derived.range}
                  rows={derived.products}
                  onEmptyExport={onEmptyExport}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-enter enter-6 shrink-0">
          <ExportsAccountingSection
            agingDetails={derived.agingDetails}
            canExport={canExport}
            canExportFec={canExportFec}
            canViewBySales={canViewBySales}
            currency={filters.currency}
            filterSummary={filterSummary}
            pipelineQuotes={derived.pipelineQuotes}
            products={derived.products}
            range={derived.range}
            sales={derived.sales}
            trend={derived.trend}
            onEmptyExport={onEmptyExport}
            onExported={() => {
              setNoticeTone("success");
              setNotice(t("preview.success"));
            }}
          />
        </div>
      </div>

      <SoftToast message={notice} tone={noticeTone} onDismiss={() => setNotice("")} />
    </main>
  );
}
