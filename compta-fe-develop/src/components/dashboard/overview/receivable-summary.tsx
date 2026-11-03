import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";

import { CountUp } from "@/components/count-up";
import { formatEuro, formatPercent } from "@/lib/money";
import {
  collectionRate,
  dueSoonTotal,
  overdueTotal,
  receivablesInvoiceCount,
  receivablesTotal,
} from "@/mocks/dashboard";

import { CardHeader } from "./dashboard-card";

export async function ReceivableSummary({ style }: { style?: CSSProperties }) {
  const t = await getTranslations("overview");
  const rate = formatPercent(collectionRate);

  const rows = [
    { label: t("summary.overdue"), amount: overdueTotal, color: "var(--dashboard-danger)" },
    { label: t("summary.dueSoon"), amount: dueSoonTotal, color: "var(--dashboard-warning)" },
  ];

  return (
    <section
      aria-labelledby="receivable-summary-title"
      className="dashboard-card dashboard-enter flex min-h-0 flex-col px-3.5 py-3"
      style={style}
    >
      <CardHeader
        action={t("summary.open")}
        actionHref="#dashboard-receivables"
        title={t("summary.title")}
        titleId="receivable-summary-title"
      />

      <div className="mt-2">
        <strong className="block text-[25px] leading-[1.1] font-bold tracking-[-0.03em] text-[#102342] tabular-nums">
          <CountUp value={formatEuro(receivablesTotal)} />
        </strong>
        <p className="dashboard-label mt-0.5">
          {t("summary.pending", { count: receivablesInvoiceCount })}
        </p>
      </div>

      <div className="mt-2">
        <div className="flex items-baseline justify-between gap-3 text-[10px]">
          <span className="font-semibold whitespace-nowrap text-[#13284a]">{t("summary.collected", { rate })}</span>
          <span className="truncate text-[#7a899e]" title={t("summary.collectedHint")}>
            {t("summary.collectedHint")}
          </span>
        </div>
        <div
          aria-label={t("summary.collected", { rate })}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(collectionRate * 1000) / 10}
          className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[#e6edf6]"
          role="progressbar"
        >
          <span
            className="grow-x block h-full rounded-full bg-[linear-gradient(90deg,#162a50_0%,#2f66e8_70%,#23c9d8_100%)]"
            style={{ width: rate.replace(",", ".") }}
          />
        </div>
      </div>

      <dl className="mt-auto grid gap-1 pt-1.5">
        {rows.map((row) => (
          <div
            className="soft-row flex h-[22px] items-center justify-between gap-3 rounded-[6px] bg-[#f5f8fc] px-2.5"
            key={row.label}
          >
            <dt className="flex min-w-0 items-center gap-2 text-[10px] text-[#4b5b74]">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="truncate">{row.label}</span>
            </dt>
            <dd className="text-[11px] font-semibold whitespace-nowrap text-[#13284a] tabular-nums">
              {formatEuro(row.amount)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
