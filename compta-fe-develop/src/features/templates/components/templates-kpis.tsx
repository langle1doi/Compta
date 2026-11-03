"use client";

import { FileStack, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { enterStyle } from "@/components/dashboard/overview/dashboard-card";
import { IconTile } from "@/components/dashboard/tone";
import type { Tone } from "@/mocks/dashboard/types";

import type { TemplatesKpis } from "../model";

export function TemplatesKpisStrip({ kpis }: { kpis: TemplatesKpis }) {
  const t = useTranslations("templates.kpis");

  const cards: {
    key: keyof TemplatesKpis;
    icon: typeof FileStack;
    tone: Tone;
    order: number;
  }[] = [
    { key: "total", icon: FileStack, tone: "blue", order: 1 },
    { key: "active", icon: ShieldCheck, tone: "green", order: 1.2 },
    { key: "custom", icon: Sparkles, tone: "purple", order: 1.4 },
    { key: "defaults", icon: FileText, tone: "orange", order: 1.6 },
  ];

  return (
    <section className="grid shrink-0 grid-cols-1 gap-[var(--dashboard-gap)] sm:grid-cols-2 xl:grid-cols-4">
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
              {kpis[card.key]}
            </p>
            <p className="truncate text-[10px] text-[#98a4b5]">{t(`${card.key}Helper`)}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
