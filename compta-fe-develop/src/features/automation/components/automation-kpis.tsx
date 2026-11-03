"use client";

import { Activity, CircleAlert, Percent, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

import { CountUp } from "@/components/count-up";
import { enterStyle } from "@/components/dashboard/overview/dashboard-card";
import { IconTile } from "@/components/dashboard/tone";
import { formatPercent } from "@/lib/money";
import type { Tone } from "@/mocks/dashboard/types";

import type { AutomationKpis } from "../model";

export function AutomationKpisStrip({
  kpis,
  onNeedsAttention,
}: {
  kpis: AutomationKpis;
  onNeedsAttention?: () => void;
}) {
  const t = useTranslations("automation.kpis");

  const cards: {
    key: string;
    icon: typeof Zap;
    tone: Tone;
    value: string;
    helper: string;
    order: number;
    onClick?: () => void;
  }[] = [
    {
      key: "active",
      icon: Zap,
      tone: "green",
      value: String(kpis.activeCount),
      helper: t("activeHelper", { total: kpis.configuredCount }),
      order: 1,
    },
    {
      key: "actions",
      icon: Activity,
      tone: "blue",
      value: String(kpis.actionsThisMonth),
      helper: t("actionsHelper"),
      order: 1.5,
    },
    {
      key: "attention",
      icon: CircleAlert,
      tone: "orange",
      value: String(kpis.needsAttention),
      helper: t("attentionHelper"),
      order: 2,
      onClick: onNeedsAttention,
    },
    {
      key: "success",
      icon: Percent,
      tone: "purple",
      value: kpis.successRate === null ? "—" : formatPercent(kpis.successRate),
      helper: t("successHelper"),
      order: 2.5,
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
          {card.onClick ? (
            <button
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              type="button"
              onClick={card.onClick}
            >
              <KpiBody card={card} label={t(card.key)} />
            </button>
          ) : (
            <KpiBody card={card} label={t(card.key)} />
          )}
        </article>
      ))}
    </section>
  );
}

function KpiBody({
  card,
  label,
}: {
  card: {
    icon: typeof Zap;
    tone: Tone;
    value: string;
    helper: string;
  };
  label: string;
}) {
  return (
    <>
      <IconTile className="kpi-icon" icon={card.icon} size="sm" strokeWidth={2.15} tone={card.tone} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-medium text-[#7a899e]">{label}</p>
        <strong className="mt-0.5 block truncate text-[22px] leading-[1.08] font-bold tracking-[-0.03em] text-[#102342] tabular-nums">
          <CountUp value={card.value} />
        </strong>
        <p className="mt-0.5 truncate text-[10px] text-[#98a4b5]">{card.helper}</p>
      </div>
    </>
  );
}
