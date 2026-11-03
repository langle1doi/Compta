"use client";

import {
  AlertCircle,
  CircleDollarSign,
  Clock3,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { CountUp } from "@/components/count-up";
import { IconTile } from "@/components/dashboard/tone";
import { useCan } from "@/features/settings/can";
import type { PermissionId } from "@/features/settings/types";
import type { Tone } from "@/mocks/dashboard/types";

import type { CustomerKpis } from "../types";

const cards: Array<{
  key: "total" | "active" | "revenue" | "quotes" | "overdue";
  icon: LucideIcon;
  tone: Tone;
  permission: PermissionId;
}> = [
  {
    key: "total",
    icon: Users,
    tone: "blue",
    permission: "customer.read",
  },
  {
    key: "active",
    icon: UserCheck,
    tone: "green",
    permission: "customer.read",
  },
  {
    key: "revenue",
    icon: CircleDollarSign,
    tone: "blue",
    permission: "invoice.read",
  },
  {
    key: "quotes",
    icon: Clock3,
    tone: "purple",
    permission: "quote.read",
  },
  {
    key: "overdue",
    icon: AlertCircle,
    tone: "red",
    permission: "invoice.read",
  },
];

/** Invoices and quotes have no backend yet: shown as unknown rather than as a misleading 0. */
const NOT_AVAILABLE = "—";

export function CustomerKpisStrip({ kpis }: { kpis: CustomerKpis }) {
  const t = useTranslations("customers.kpis");
  const check = useCan();
  const visibleCards = cards.filter((card) => check(card.permission));

  const values = {
    total: String(kpis.totalCustomers),
    active: String(kpis.activeCustomers),
    revenue: NOT_AVAILABLE,
    quotes: NOT_AVAILABLE,
    overdue: NOT_AVAILABLE,
  };

  return (
    <section
      className="grid shrink-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 lg:[grid-template-columns:repeat(var(--kpi-count),minmax(0,1fr))]"
      style={{ "--kpi-count": visibleCards.length } as CSSProperties}
    >
      {visibleCards.map((card) => (
        <article
          className="dashboard-card kpi-card flex h-[84px] min-w-0 items-center gap-2.5 px-3 py-2.5 sm:h-[88px]"
          key={card.key}
        >
          <IconTile
            className="kpi-icon"
            icon={card.icon}
            size="md"
            strokeWidth={2.15}
            tone={card.tone}
          />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-[#7d8aa0]">{t(card.key)}</p>
            <p className="mt-1 truncate text-[26px] leading-none font-semibold tracking-[-0.03em] text-[#063586] tabular-nums">
              <CountUp value={values[card.key]} />
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
