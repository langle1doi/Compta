"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { DashboardScroll } from "@/components/dashboard/dashboard-scroll";
import { StatusBadge } from "@/components/dashboard/tone";
import {
  buildPipelineSummary,
  buildQuotePipeline,
} from "@/features/quotes/dashboard-source";
import { useLedger } from "@/features/quotes/store";
import { formatPercent, parseAmount } from "@/lib/money";

import { CardHeader } from "./dashboard-card";

export function QuotePipeline({ style }: { style?: CSSProperties }) {
  const t = useTranslations();
  const ledger = useLedger();
  const quotePipeline = useMemo(
    () => buildQuotePipeline(ledger.quotes),
    [ledger.quotes],
  );
  const pipelineSummary = useMemo(
    () => buildPipelineSummary(ledger.quotes),
    [ledger.quotes],
  );
  const total = quotePipeline.reduce((sum, stage) => sum + parseAmount(stage.value), 0);

  return (
    <section
      aria-labelledby="quote-pipeline-title"
      className="dashboard-card dashboard-list dashboard-enter flex h-[340px] min-h-0 flex-col overflow-hidden lg:h-full"
      style={style}
    >
      <div className="dashboard-list__header">
        <CardHeader action={t("pipeline.board")} title={t("pipeline.title")} titleId="quote-pipeline-title" />

        <div className="mt-2.5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <span className="dashboard-list__secondary">{t("pipeline.openValue")}</span>
            <strong className="mt-0.5 block text-[20px] leading-[1.1] font-bold tracking-[-0.03em] text-[#102342] tabular-nums">
              {pipelineSummary.openValue}
            </strong>
          </div>
          <StatusBadge className="dashboard-list__badge shrink-0" size="xs" tone="green">
            {t("pipeline.close", { rate: pipelineSummary.closeRate })}
          </StatusBadge>
        </div>
        <div aria-hidden="true" className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-[rgb(222_230_240/0.75)]">
          <div className="grow-x flex h-full gap-[2px]">
            {quotePipeline.map((stage) => (
              <span
                className="h-full first:rounded-l-full last:rounded-r-full"
                key={stage.labelKey}
                style={{
                  width: formatPercent(parseAmount(stage.value) / total).replace(",", "."),
                  backgroundColor: stage.color,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <DashboardScroll>
        <ul className="border-t border-[rgb(217_227_238/0.72)]">
          {quotePipeline.map((stage) => (
            <li className="dashboard-list__row" key={stage.labelKey}>
              <span aria-hidden="true" className="dashboard-list__chip" style={{ backgroundColor: stage.color }} />
              <span className="min-w-0 flex-1">
                <span className="dashboard-list__primary">{t(stage.labelKey)}</span>
                <span className="dashboard-list__secondary">{t("pipeline.documents", { count: stage.count })}</span>
              </span>
              <strong className="dashboard-list__amount">{stage.value}</strong>
            </li>
          ))}
        </ul>
      </DashboardScroll>
    </section>
  );
}
