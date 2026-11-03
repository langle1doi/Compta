"use client";

import { useTranslations } from "next-intl";

import { CountUp } from "@/components/count-up";
import { enterStyle } from "@/components/dashboard/overview/dashboard-card";
import {
  KpiCardIcon,
  KpiClockIcon,
  KpiDollarIcon,
  KpiFileCheckIcon,
} from "@/components/dashboard/overview/kpi-icons";
import { IconTile } from "@/components/dashboard/tone";
import type { Tone } from "@/mocks/dashboard/types";

import {
  formatPaymentKpiDelta,
  formatPaymentKpiValue,
  type PaymentKpis,
} from "../kpis";

const cards: Array<{
  key: "collected" | "outstanding" | "partial" | "overdue";
  icon: typeof KpiDollarIcon;
  tone: Tone;
  order: number;
}> = [
  { key: "collected", icon: KpiCardIcon, tone: "green", order: 1 },
  { key: "outstanding", icon: KpiDollarIcon, tone: "purple", order: 1.5 },
  { key: "partial", icon: KpiFileCheckIcon, tone: "orange", order: 2 },
  { key: "overdue", icon: KpiClockIcon, tone: "red", order: 2.5 },
];

const toneBadge: Record<Tone, string> = {
  blue: "bg-[#e7efff] text-[#044ce2]",
  green: "bg-[#e8f7f0] text-[#238567]",
  orange: "bg-[#fff4e6] text-[#b96d24]",
  red: "bg-[#fff0ed] text-[#c9564f]",
  purple: "bg-[#f2edff] text-[#7b61c8]",
  slate: "bg-[#eef2f7] text-[#66758d]",
};

export function PaymentKpisStrip({ kpis }: { kpis: PaymentKpis }) {
  const t = useTranslations("payments.kpis");

  const values = {
    collected: formatPaymentKpiValue(kpis.collectedCents),
    outstanding: formatPaymentKpiValue(kpis.outstandingCents),
    partial: formatPaymentKpiValue(kpis.partialCents),
    overdue: formatPaymentKpiValue(kpis.overdueCents),
  };

  const deltas = {
    collected: formatPaymentKpiDelta(kpis.collectedDeltaRatio),
    outstanding: formatPaymentKpiDelta(kpis.outstandingDeltaRatio),
    partial: formatPaymentKpiDelta(kpis.partialDeltaRatio),
    overdue: formatPaymentKpiDelta(kpis.overdueDeltaRatio),
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
                {deltas[card.key]}
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
