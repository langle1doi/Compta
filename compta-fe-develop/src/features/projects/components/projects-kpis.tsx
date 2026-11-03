"use client";

import { Coins, FolderKanban, Percent, PlayCircle, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";

import { enterStyle } from "@/components/dashboard/overview/dashboard-card";
import { IconTile } from "@/components/dashboard/tone";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";
import type { Tone } from "@/mocks/dashboard/types";

import type { ProjectsKpis } from "../model";

export function ProjectsKpisStrip({ kpis }: { kpis: ProjectsKpis }) {
  const t = useTranslations("projects.kpis");

  const cards: {
    key: string;
    icon: typeof FolderKanban;
    tone: Tone;
    value: string;
    helper: string;
    order: number;
  }[] = [
    {
      key: "total",
      icon: FolderKanban,
      tone: "blue",
      value: String(kpis.totalProjects),
      helper: t("totalHelper"),
      order: 1,
    },
    {
      key: "active",
      icon: PlayCircle,
      tone: "green",
      value: String(kpis.activeProjects),
      helper: t("activeHelper"),
      order: 1.2,
    },
    {
      key: "revenue",
      icon: ReceiptText,
      tone: "blue",
      value: formatMoneyFromCents(kpis.revenueCents),
      helper: t("revenueHelper"),
      order: 1.4,
    },
    {
      key: "costs",
      icon: Coins,
      tone: "orange",
      value: formatMoneyFromCents(kpis.costCents),
      helper: t("costsHelper"),
      order: 1.6,
    },
    {
      key: "margin",
      icon: Percent,
      tone: "purple",
      value:
        kpis.marginRatio === null
          ? t("na")
          : formatPercent(kpis.marginRatio),
      helper: t("marginHelper", {
        profit: formatMoneyFromCents(kpis.profitCents),
      }),
      order: 1.8,
    },
  ];

  return (
    <section className="grid shrink-0 grid-cols-1 gap-[var(--dashboard-gap)] sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <article
          className="dashboard-card kpi-card dashboard-enter flex min-h-[72px] min-w-0 items-center gap-3 px-3 py-2"
          key={card.key}
          style={enterStyle(card.order)}
        >
          <IconTile icon={card.icon} size="sm" tone={card.tone} />
          <div className="min-w-0">
            <p className="dashboard-label text-[10px]">{t(card.key)}</p>
            <p className="truncate text-[16px] font-semibold tabular-nums text-[#24334c]">
              {card.value}
            </p>
            <p className="truncate text-[10px] text-[#98a4b5]">{card.helper}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
