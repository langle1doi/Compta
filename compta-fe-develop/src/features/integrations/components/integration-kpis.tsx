"use client";

import { Clock3, Link2, PlugZap, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { CountUp } from "@/components/count-up";
import { enterStyle } from "@/components/dashboard/overview/dashboard-card";
import { IconTile } from "@/components/dashboard/tone";
import type { Tone } from "@/mocks/dashboard/types";

export type IntegrationKpiValues = {
  available: number;
  connected: number;
  ready: number;
  comingSoon: number;
};

export function IntegrationKpis({ kpis }: { kpis: IntegrationKpiValues }) {
  const t = useTranslations("integrations.kpis");

  const cards: {
    key: keyof IntegrationKpiValues;
    icon: typeof Link2;
    tone: Tone;
    value: number;
    order: number;
  }[] = [
    { key: "available", icon: Sparkles, tone: "blue", value: kpis.available, order: 1 },
    { key: "connected", icon: Link2, tone: "green", value: kpis.connected, order: 1.2 },
    { key: "ready", icon: PlugZap, tone: "blue", value: kpis.ready, order: 1.4 },
    { key: "comingSoon", icon: Clock3, tone: "purple", value: kpis.comingSoon, order: 1.6 },
  ];

  return (
    <section className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          className="kpi-elevation flex min-h-[104px] min-w-0 items-center gap-3.5 rounded-[16px] border border-[rgba(210,224,242,.9)] bg-[rgba(255,255,255,.82)] px-5 py-[18px]"
          key={card.key}
          style={enterStyle(card.order)}
        >
          <IconTile
            className="!h-[42px] !w-[42px] !rounded-[12px] [&>svg]:!h-5 [&>svg]:!w-5"
            icon={card.icon}
            size="md"
            strokeWidth={2}
            tone={card.tone}
          />
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[26px] leading-[1.05] font-bold tracking-[-0.03em] text-[#102342] tabular-nums">
              <CountUp value={String(card.value)} />
            </strong>
            <p className="mt-1 truncate text-[12px] font-medium text-[#7a899e]">
              {t(card.key)}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
