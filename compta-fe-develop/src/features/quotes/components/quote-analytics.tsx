"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { CardHeader, LegendDot } from "@/components/dashboard/overview/dashboard-card";
import { StatusDonut } from "@/components/dashboard/overview/status-donut";
import { useRevealOnce } from "@/components/dashboard/overview/use-reveal-once";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

import { getQuoteKpis } from "../kpis";
import { quoteTotals, type QuoteRecord } from "../model";
import { QUOTE_STATUS_ORDER, quoteStatusColor } from "../status";

export function QuoteAnalytics({ quotes }: { quotes: QuoteRecord[] }) {
  const t = useTranslations();
  const register = useTranslations("register");
  const [barsRef, barsRevealed] = useRevealOnce<HTMLUListElement>(0.15);

  const byStatus = useMemo(() => {
    return QUOTE_STATUS_ORDER.map((status) => {
      const rows = quotes.filter((quote) => quote.status === status);
      const amountCents = rows.reduce((sum, quote) => sum + quoteTotals(quote).ttcCents, 0);
      return {
        status,
        count: rows.length,
        amountCents,
        color: quoteStatusColor[status],
        label: t(`status.${status}`),
      };
    });
  }, [quotes, t]);

  const totalCount = quotes.length;
  const maxAmount = Math.max(...byStatus.map((item) => item.amountCents), 1);
  const kpis = useMemo(() => getQuoteKpis(quotes), [quotes]);
  const insightUp = kpis.acceptedDelta >= 0;

  const donutSegments = byStatus.map((item) => ({
    key: item.status,
    label: item.label,
    amount: item.count,
    color: item.color,
  }));

  return (
    <aside className="flex min-h-0 min-w-0 flex-col gap-3 lg:w-[min(100%,320px)] xl:w-[300px]">
      <StatusDonut
        centerLabel={register("analytics.quotesLabel")}
        centerValue={String(totalCount)}
        formatSegmentValue={(count) =>
          register("analytics.documents", { count: Math.round(count) })
        }
        id="quote-pipeline-donut"
        segments={donutSegments}
        title={register("analytics.pipeline")}
      />

      <section
        aria-labelledby="quote-value-by-status-title"
        className="dashboard-card dashboard-list flex min-h-0 flex-col overflow-hidden"
      >
        <div className="dashboard-list__header">
          <CardHeader
            title={register("analytics.valueByStatus")}
            titleId="quote-value-by-status-title"
          />
        </div>
        <ul
          className="border-t border-[rgb(217_227_238/0.72)] px-1 py-1"
          data-revealed={barsRevealed}
          ref={barsRef}
        >
          {byStatus.map((item, index) => {
            const width = formatPercent(item.amountCents / maxAmount).replace(",", ".");
            return (
              <li className="dashboard-list__row gap-2" key={item.status}>
                <LegendDot color={item.color} />
                <span className="min-w-0 flex-1">
                  <span className="dashboard-list__primary">{item.label}</span>
                  <span
                    aria-hidden="true"
                    className="mt-1 block h-[5px] overflow-hidden rounded-full bg-[rgb(222_230_240/0.75)]"
                  >
                    <span
                      className={cn("block h-full rounded-full origin-left", barsRevealed && "grow-x")}
                      key={barsRevealed ? `${item.status}-grow` : item.status}
                      style={{
                        width: barsRevealed ? width : "0%",
                        backgroundColor: item.color,
                        animationDelay: `${80 + index * 60}ms`,
                      }}
                    />
                  </span>
                </span>
                <strong className="dashboard-list__amount shrink-0">
                  {formatMoneyFromCents(item.amountCents)}
                </strong>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="dashboard-card px-3.5 py-3">
        <p className="dashboard-card-title">{register("analytics.insight")}</p>
        <p className="mt-1.5 text-xs leading-5 text-[#516078]">
          {insightUp
            ? register("analytics.insightAcceptedUp", { percent: 20 })
            : register("analytics.insightAcceptedDown", { percent: 12 })}
        </p>
      </section>
    </aside>
  );
}
