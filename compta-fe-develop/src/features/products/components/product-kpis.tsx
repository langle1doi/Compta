"use client";

import {
  CircleDollarSign,
  Package,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { CountUp } from "@/components/count-up";
import { enterStyle } from "@/components/dashboard/overview/dashboard-card";
import { IconTile } from "@/components/dashboard/tone";
import type { Tone } from "@/mocks/dashboard/types";

import { formatProductMoney, type ProductKpis } from "../kpis";

const cards: Array<{
  key: "total" | "used" | "revenue" | "top";
  icon: LucideIcon;
  tone: Tone;
  order: number;
}> = [
  { key: "total", icon: Package, tone: "blue", order: 1 },
  { key: "used", icon: TrendingUp, tone: "purple", order: 1.5 },
  { key: "revenue", icon: CircleDollarSign, tone: "green", order: 2 },
  { key: "top", icon: Sparkles, tone: "orange", order: 2.5 },
];

export function ProductKpisStrip({ kpis }: { kpis: ProductKpis }) {
  const t = useTranslations("products.kpis");

  const values = {
    total: String(kpis.total),
    used: String(kpis.usedThisMonth),
    revenue: formatProductMoney(kpis.revenueThisMonthCents),
    top: kpis.topProductName,
  };

  const hints = {
    total: t("totalHint", { active: kpis.active, inactive: kpis.inactive }),
    used: t("usedHint"),
    revenue: t("revenueHint"),
    top:
      kpis.topProductUses > 0
        ? t("topHint", {
            amount: formatProductMoney(kpis.topProductRevenueCents),
            uses: kpis.topProductUses,
          })
        : t("topEmpty"),
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
            <p className="truncate text-[10px] font-medium text-[#7a899e]">{t(card.key)}</p>
            <strong
              className={`block leading-[1.1] font-bold tracking-[-0.03em] text-[#102342] ${
                card.key === "top"
                  ? "truncate text-[16px] sm:text-[18px]"
                  : "text-[22px] tabular-nums"
              }`}
              title={card.key === "top" ? values.top : undefined}
            >
              {card.key === "top" ? (
                values.top
              ) : (
                <CountUp value={values[card.key]} />
              )}
            </strong>
            <p className="mt-0.5 truncate text-[10px] text-[#7d8aa0]">{hints[card.key]}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
