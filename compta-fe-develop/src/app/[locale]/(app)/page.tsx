import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ActivityPanel } from "@/components/dashboard/activity/activity-panel";
import { AttentionGate } from "@/components/dashboard/attention-gate";
import { CompanyWidget, HeroRoleValue } from "@/components/dashboard/dashboard-gates";
import { AnnualTargetCard } from "@/components/dashboard/overview/annual-target-card";
import { BusinessHealthRadar } from "@/components/dashboard/overview/business-health-radar";
import { enterStyle } from "@/components/dashboard/overview/dashboard-card";
import { DashboardControls } from "@/components/dashboard/overview/dashboard-controls";
import { PaymentsDonut, ReceivablesDonut } from "@/components/dashboard/overview/finance-donuts";
import { KpiStrip } from "@/components/dashboard/overview/kpi-strip";
import { DashboardPeriodProvider } from "@/components/dashboard/overview/period-context";
import { QuotePipeline } from "@/components/dashboard/overview/quote-pipeline";
import { HeroCompanyBadge } from "@/components/dashboard/hero-company-badge";
import { ReceivableSummary } from "@/components/dashboard/overview/receivable-summary";
import { RevenueChart } from "@/components/dashboard/overview/revenue-chart";
import { DashboardAttentionLive } from "@/components/dashboard/dashboard-attention-live";
import { DashboardInvoicesLive } from "@/components/dashboard/dashboard-invoices-live";
import { DashboardQuotesLive } from "@/components/dashboard/dashboard-quotes-live";
import { StatusBadge } from "@/components/dashboard/tone";
import { Can } from "@/features/settings/can";
import { actionItems, invoicesToFollow } from "@/mocks/dashboard";

export default async function Home() {
  const t = await getTranslations();

  return (
    <main className="app-scroll dashboard-canvas min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
      <DashboardPeriodProvider>
        <div className="dashboard-page dashboard-anchor dashboard-stack min-w-0" data-scroll-chain-page="true" id="dashboard-top">
          <DashboardControls />

          <div className="dashboard-grid-hero">
            <section
              aria-labelledby="hero-title"
              className="hero-shell hero-enter @container relative min-w-0 overflow-hidden text-white"
              style={{ animationDelay: "20ms" }}
            >
              <div aria-hidden="true" className="hero-ambient" />
              <div className="relative z-[1] grid h-full items-stretch gap-4 @[560px]:grid-cols-[minmax(0,1.55fr)_minmax(240px,0.85fr)]">
                <div className="flex min-w-0 flex-col">
                  <div className="hero-piece flex flex-wrap items-center gap-1.5" style={{ animationDelay: "80ms" }}>
                    <StatusBadge size="sm" tone="green">
                      {t("hero.active")}
                    </StatusBadge>
                    <HeroCompanyBadge />
                  </div>
                  <h2
                    className="hero-piece mt-1.5 max-w-[450px] text-[22px] leading-[1.12] font-bold tracking-[-0.025em] text-balance"
                    id="hero-title"
                    style={{ animationDelay: "125ms" }}
                  >
                    {t("hero.title")}
                  </h2>
                  <p
                    className="hero-piece mt-1.5 max-w-[480px] text-[11px] leading-[1.55] text-white/72"
                    style={{ animationDelay: "170ms" }}
                  >
                    {t("hero.body")}
                  </p>
                  <div className="hero-piece mt-auto flex flex-wrap gap-2 pt-2.5" style={{ animationDelay: "215ms" }}>
                    <button className="hero-action hero-cta bg-white text-[#13284a]" type="button">
                      {t("hero.priorities")}
                      <ArrowUpRight aria-hidden="true" className="hero-arrow h-3.5 w-3.5" />
                    </button>
                    <Can permission="audit.read">
                      <button
                        className="hero-action hero-cta border border-white/14 bg-white/7 text-white hover:bg-white/12"
                        type="button"
                      >
                        {t("hero.audit")}
                      </button>
                    </Can>
                  </div>
                </div>

                <div className="hero-piece tenant-panel self-stretch" style={{ animationDelay: "260ms" }}>
                  <p className="text-[11px] leading-[13px] font-semibold text-white">{t("hero.tenant")}</p>
                  <dl className="mt-1 space-y-1">
                    {[
                      [t("hero.isolation"), "OK"],
                      [t("hero.sequence"), "FAC20260127"],
                      [t("hero.aiMode"), t("hero.suggestion")],
                    ].map(([label, value], rowIndex) => (
                      <div
                        className="tenant-row flex h-[26px] items-center justify-between gap-3 rounded-[6px] bg-white/7 px-2.5 text-[10px]"
                        key={label}
                        style={{ animationDelay: `${290 + rowIndex * 35}ms` }}
                      >
                        <dt className="min-w-0 truncate text-[#b7c3d6]" title={label}>
                          {label}
                        </dt>
                        <dd className="font-semibold whitespace-nowrap text-white">{value}</dd>
                      </div>
                    ))}
                    <div
                      className="tenant-row flex h-[26px] items-center justify-between gap-3 rounded-[6px] bg-white/7 px-2.5 text-[10px]"
                      style={{ animationDelay: "395ms" }}
                    >
                      <dt className="min-w-0 truncate text-[#b7c3d6]" title={t("hero.role")}>
                        {t("hero.role")}
                      </dt>
                      <dd className="min-w-0 truncate font-semibold whitespace-nowrap text-white">
                        <HeroRoleValue />
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </section>

            <CompanyWidget permission="invoice.read">
              <ReceivableSummary style={enterStyle(1)} />
            </CompanyWidget>
          </div>

          <KpiStrip startOrder={2} />

          <div className="dashboard-grid-main lg:h-[214px]">
            <CompanyWidget permission="report.read">
              <RevenueChart style={enterStyle(3)} />
            </CompanyWidget>
            <CompanyWidget permission="report.read">
              <BusinessHealthRadar style={enterStyle(4)} />
            </CompanyWidget>
          </div>

          <div className="dashboard-grid-3 xl:h-[204px]">
            <CompanyWidget permission="invoice.read">
              <ReceivablesDonut style={enterStyle(5)} />
            </CompanyWidget>
            <CompanyWidget permission="payment.read">
              <PaymentsDonut style={enterStyle(5.5)} />
            </CompanyWidget>
            <CompanyWidget permission="report.read">
              <AnnualTargetCard style={enterStyle(6)} />
            </CompanyWidget>
          </div>

          <div className="dashboard-grid-main dashboard-grid-main--quotes lg:h-[300px]">
            <Can permission="quote.read">
              <section
                aria-labelledby="recent-quotes-title"
                className="dashboard-card dashboard-list dashboard-enter dashboard-anchor flex h-[340px] min-h-0 min-w-0 flex-col overflow-hidden lg:h-full"
                id="dashboard-quotes"
                style={enterStyle(7)}
              >
                <DashboardQuotesLive />
              </section>
            </Can>

            <CompanyWidget permission="quote.read">
              <QuotePipeline style={enterStyle(7.5)} />
            </CompanyWidget>
          </div>

          <div className="dashboard-grid-half lg:h-[252px]">
            <AttentionGate items={actionItems}>
              <section
                aria-labelledby="attention-title"
                className="dashboard-card dashboard-enter flex h-[300px] min-h-0 min-w-0 flex-col overflow-hidden px-3.5 py-3 md:h-[252px] lg:h-full"
                style={enterStyle(8)}
              >
                <DashboardAttentionLive items={actionItems} />
              </section>
            </AttentionGate>

            <Can permission="invoice.read">
              <section
                aria-labelledby="invoices-title"
                className="dashboard-card dashboard-enter dashboard-anchor flex h-[300px] min-h-0 min-w-0 flex-col overflow-hidden px-3.5 py-3 md:h-[252px] lg:h-full"
                id="dashboard-invoices"
                style={enterStyle(8.5)}
              >
                <DashboardInvoicesLive invoices={invoicesToFollow} />
              </section>
            </Can>
          </div>

          <CompanyWidget permission="dashboard.view">
            <ActivityPanel className="activity-compact h-[460px] md:h-[360px] lg:h-[168px]" />
          </CompanyWidget>
        </div>
      </DashboardPeriodProvider>
    </main>
  );
}
