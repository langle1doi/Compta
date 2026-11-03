import type { ComponentType, SVGProps } from "react";
import { getTranslations } from "next-intl/server";

import { CountUp } from "@/components/count-up";
import { CompanyWidget } from "@/components/dashboard/dashboard-gates";
import { IconTile } from "@/components/dashboard/tone";
import type { PermissionId } from "@/features/settings/types";
import {
  KpiCardIcon,
  KpiClockIcon,
  KpiDollarIcon,
  KpiFileCheckIcon,
} from "@/components/dashboard/overview/kpi-icons";
import { formatEuro, formatPercent } from "@/lib/money";
import {
  currentMonthRevenue,
  overdueTotal,
  pipelineSummary,
  previousMonthRevenue,
  receivableSegments,
  receivablesInvoiceCount,
  receivablesTotal,
  type Tone,
} from "@/mocks/dashboard";

import { enterStyle } from "./dashboard-card";

const toneBadge: Record<Tone, string> = {
  blue: "bg-[#e7efff] text-[#044ce2]",
  green: "bg-[#e8f7f0] text-[#238567]",
  orange: "bg-[#fff4e6] text-[#b96d24]",
  red: "bg-[#fff0ed] text-[#c9564f]",
  purple: "bg-[#f2edff] text-[#7b61c8]",
  slate: "bg-[#eef2f7] text-[#66758d]",
};

type Kpi = {
  key: string;
  permission: PermissionId;
  label: string;
  value: string;
  badge: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
  tone: Tone;
};

export async function KpiStrip({ startOrder }: { startOrder: number }) {
  const t = await getTranslations();
  const revenueDelta = formatPercent(currentMonthRevenue / previousMonthRevenue - 1);
  const overdueInvoices =
    receivableSegments.find((segment) => segment.key === "overdue")?.invoices ?? 0;

  const kpis: Kpi[] = [
    {
      key: "revenue",
      permission: "report.read",
      label: t("kpi.revenue"),
      value: formatEuro(currentMonthRevenue),
      badge: `+${revenueDelta}`,
      icon: KpiDollarIcon,
      tone: "blue",
    },
    {
      key: "receivable",
      permission: "invoice.read",
      label: t("kpi.receivable"),
      value: formatEuro(receivablesTotal),
      badge: t("kpi.invoiceCount", { count: receivablesInvoiceCount }),
      icon: KpiCardIcon,
      tone: "purple",
    },
    {
      key: "overdue",
      permission: "invoice.read",
      label: t("kpi.overdue"),
      value: formatEuro(overdueTotal),
      badge: t("kpi.invoiceCount", { count: overdueInvoices }),
      icon: KpiClockIcon,
      tone: "orange",
    },
    {
      key: "winRate",
      permission: "quote.read",
      label: t("kpi.winRate"),
      value: pipelineSummary.closeRate,
      badge: "+8,2%",
      icon: KpiFileCheckIcon,
      tone: "green",
    },
  ];

  return (
    <section className="dashboard-grid-2 dashboard-grid-2--kpi">
      {kpis.map((kpi, index) => (
        <CompanyWidget key={kpi.key} permission={kpi.permission}>
          <article
            className="dashboard-card kpi-card clickable-surface dashboard-enter flex min-h-[70px] min-w-0 items-center gap-3 px-3 py-2"
            style={enterStyle(startOrder + index * 0.5)}
          >
            <IconTile className="kpi-icon" icon={kpi.icon} size="sm" strokeWidth={2.15} tone={kpi.tone} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="truncate text-[10px] font-medium text-[#7a899e]">{kpi.label}</p>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-[3px] text-[9px] leading-none font-semibold ${toneBadge[kpi.tone]}`}
                >
                  {kpi.badge}
                </span>
              </div>
              <strong className="block text-[22px] leading-[1.1] font-bold tracking-[-0.03em] text-[#102342] tabular-nums">
                <CountUp value={kpi.value} />
              </strong>
            </div>
          </article>
        </CompanyWidget>
      ))}
    </section>
  );
}
