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
  formatInvoiceKpiDelta,
  formatInvoiceKpiValue,
  type InvoiceKpis,
} from "../kpis";

const cards: Array<{
  key: "invoiced" | "outstanding" | "overdue" | "paid";
  icon: typeof KpiFileCheckIcon;
  tone: Tone;
  order: number;
  deltaKey: keyof Pick<
    InvoiceKpis,
    "invoicedDeltaRatio" | "outstandingDeltaRatio" | "overdueDeltaRatio" | "paidDeltaRatio"
  >;
  valueKey: keyof Pick<InvoiceKpis, "invoicedCents" | "outstandingCents" | "overdueCents" | "paidCents">;
}> = [
  { key: "invoiced", icon: KpiFileCheckIcon, tone: "blue", order: 1, deltaKey: "invoicedDeltaRatio", valueKey: "invoicedCents" },
  { key: "outstanding", icon: KpiDollarIcon, tone: "purple", order: 1.5, deltaKey: "outstandingDeltaRatio", valueKey: "outstandingCents" },
  { key: "overdue", icon: KpiClockIcon, tone: "orange", order: 2, deltaKey: "overdueDeltaRatio", valueKey: "overdueCents" },
  { key: "paid", icon: KpiDollarIcon, tone: "green", order: 2.5, deltaKey: "paidDeltaRatio", valueKey: "paidCents" },
];

const toneBadge: Record<Tone, string> = {
  blue: "bg-[#e7efff] text-[#044ce2]",
  green: "bg-[#e8f7f0] text-[#238567]",
  orange: "bg-[#fff4e6] text-[#b96d24]",
  red: "bg-[#fff0ed] text-[#c9564f]",
  purple: "bg-[#f2edff] text-[#7b61c8]",
  slate: "bg-[#eef2f7] text-[#66758d]",
};

export function InvoiceKpisStrip({ kpis }: { kpis: InvoiceKpis }) {
  const t = useTranslations("invoices.kpis");

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
                {formatInvoiceKpiDelta(kpis[card.deltaKey])}
              </span>
            </div>
            <strong className="block text-[22px] leading-[1.1] font-bold tracking-[-0.03em] text-[#102342] tabular-nums">
              <CountUp value={formatInvoiceKpiValue(kpis[card.valueKey])} />
            </strong>
          </div>
        </article>
      ))}
    </section>
  );
}
