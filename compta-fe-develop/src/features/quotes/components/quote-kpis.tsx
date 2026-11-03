"use client";

import { useTranslations } from "next-intl";

import { CountUp } from "@/components/count-up";
import { enterStyle } from "@/components/dashboard/overview/dashboard-card";
import {
  KpiClockIcon,
  KpiDollarIcon,
  KpiFileCheckIcon,
} from "@/components/dashboard/overview/kpi-icons";
import { IconTile } from "@/components/dashboard/tone";
import type { Tone } from "@/mocks/dashboard/types";

import {
  formatDelta,
  formatQuoteValue,
  formatValueDelta,
  type QuoteKpis,
} from "../kpis";

const cards: Array<{
  key: "open" | "awaiting" | "accepted" | "value";
  icon: typeof KpiFileCheckIcon;
  tone: Tone;
  order: number;
}> = [
  { key: "open", icon: KpiFileCheckIcon, tone: "blue", order: 1 },
  { key: "awaiting", icon: KpiClockIcon, tone: "orange", order: 1.5 },
  { key: "accepted", icon: KpiFileCheckIcon, tone: "green", order: 2 },
  { key: "value", icon: KpiDollarIcon, tone: "purple", order: 2.5 },
];

const toneBadge: Record<Tone, string> = {
  blue: "bg-[#e7efff] text-[#044ce2]",
  green: "bg-[#e8f7f0] text-[#238567]",
  orange: "bg-[#fff4e6] text-[#b96d24]",
  red: "bg-[#fff0ed] text-[#c9564f]",
  purple: "bg-[#f2edff] text-[#7b61c8]",
  slate: "bg-[#eef2f7] text-[#66758d]",
};

export function QuoteKpisStrip({ kpis }: { kpis: QuoteKpis }) {
  const t = useTranslations("register.kpis");

  const values = {
    open: String(kpis.openQuotes),
    awaiting: String(kpis.awaitingApproval),
    accepted: String(kpis.acceptedThisMonth),
    value: formatQuoteValue(kpis.quoteValueCents),
  };

  const badges = {
    open: formatDelta(kpis.openDelta),
    awaiting: formatDelta(kpis.awaitingDelta),
    accepted: formatDelta(kpis.acceptedDelta),
    value: formatValueDelta(kpis.quoteValueDeltaRatio),
  };

  return (
    <section className="dashboard-grid-2 dashboard-grid-2--kpi shrink-0">
      {cards.map((card) => (
        <article
          className="dashboard-card kpi-card clickable-surface dashboard-enter flex min-h-[70px] min-w-0 items-center gap-3 px-3 py-2"
          key={card.key}
          style={enterStyle(card.order)}
        >
          <IconTile
            className="kpi-icon"
            icon={card.icon}
            size="sm"
            strokeWidth={2.15}
            tone={card.tone}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="truncate text-[10px] font-medium text-[#7a899e]">{t(card.key)}</p>
              <span
                className={`shrink-0 rounded-full px-1.5 py-[3px] text-[9px] leading-none font-semibold ${toneBadge[card.tone]}`}
              >
                {badges[card.key]}
              </span>
            </div>
            <strong className="block text-[22px] leading-[1.1] font-bold tracking-[-0.03em] text-[#102342] tabular-nums">
              <CountUp value={values[card.key]} />
            </strong>
          </div>
        </article>
      ))}
    </section>
  );
}
