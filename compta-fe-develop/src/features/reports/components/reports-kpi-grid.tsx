"use client";

import { ChartNoAxesCombined, Coins, Funnel, Percent } from "lucide-react";
import { useTranslations } from "next-intl";

import { CountUp } from "@/components/count-up";
import { enterStyle } from "@/components/dashboard/overview/dashboard-card";
import { IconTile } from "@/components/dashboard/tone";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";
import type { Tone } from "@/mocks/dashboard/types";

import type { ReportKpis } from "../model";

function trendTone(ratio: number | null, invert = false): Tone {
  if (ratio === null || ratio === 0) return "slate";
  const positive = invert ? ratio < 0 : ratio > 0;
  return positive ? "green" : "red";
}

function formatDelta(ratio: number | null) {
  if (ratio === null) return "—";
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${formatPercent(ratio)}`;
}

const toneBadge: Record<Tone, string> = {
  blue: "bg-[#e7efff] text-[#044ce2]",
  green: "bg-[#e8f7f0] text-[#238567]",
  orange: "bg-[#fff4e6] text-[#b96d24]",
  red: "bg-[#fff0ed] text-[#c9564f]",
  purple: "bg-[#f2edff] text-[#7b61c8]",
  slate: "bg-[#eef2f7] text-[#66758d]",
};

export function ReportsKpiGrid({ kpis }: { kpis: ReportKpis }) {
  const t = useTranslations("reports.kpis");

  const cards = [
    {
      key: "revenue" as const,
      icon: ChartNoAxesCombined,
      tone: "blue" as Tone,
      value: formatMoneyFromCents(kpis.revenueCents),
      helper: t("vsPrevious"),
      delta: formatDelta(kpis.revenueDeltaRatio),
      deltaTone: trendTone(kpis.revenueDeltaRatio),
      order: 1,
      unavailable: false,
    },
    {
      key: "margin" as const,
      icon: Percent,
      tone: "purple" as Tone,
      value: kpis.marginAvailable
        ? formatMoneyFromCents(kpis.marginCents ?? 0)
        : t("unavailable"),
      helper: kpis.marginAvailable
        ? kpis.marginPercent !== null
          ? formatPercent(kpis.marginPercent)
          : t("vsPrevious")
        : t("costUnavailable"),
      delta: kpis.marginAvailable ? formatDelta(kpis.marginDeltaRatio) : "—",
      deltaTone: trendTone(kpis.marginDeltaRatio),
      order: 1.5,
      unavailable: !kpis.marginAvailable,
    },
    {
      key: "outstanding" as const,
      icon: Coins,
      tone: "orange" as Tone,
      value: formatMoneyFromCents(kpis.outstandingCents),
      helper: t("vsPrevious"),
      delta: formatDelta(kpis.outstandingDeltaRatio),
      deltaTone: trendTone(kpis.outstandingDeltaRatio, true),
      order: 2,
      unavailable: false,
    },
    {
      key: "conversion" as const,
      icon: Funnel,
      tone: "green" as Tone,
      value: kpis.conversionRate === null ? t("unavailable") : formatPercent(kpis.conversionRate),
      helper: t("vsPrevious"),
      delta: formatDelta(kpis.conversionDeltaRatio),
      deltaTone: trendTone(kpis.conversionDeltaRatio),
      order: 2.5,
      unavailable: kpis.conversionRate === null,
    },
  ];

  return (
    <section className="dashboard-grid-2 dashboard-grid-2--kpi shrink-0">
      {cards.map((card) => (
        <article
          className="dashboard-card kpi-card dashboard-enter flex min-h-[72px] min-w-0 items-center gap-3 px-3 py-2"
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
                className={`shrink-0 rounded-full px-1.5 py-[3px] text-[9px] leading-none font-semibold ${toneBadge[card.deltaTone]}`}
              >
                {card.delta}
              </span>
            </div>
            <strong className="mt-0.5 block truncate text-[22px] leading-[1.08] font-bold tracking-[-0.03em] text-[#102342] tabular-nums">
              {card.unavailable ? card.value : <CountUp value={card.value} />}
            </strong>
            <p className="mt-0.5 truncate text-[10px] text-[#98a4b5]">{card.helper}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
