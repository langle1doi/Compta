"use client";

import { useRef } from "react";
import { useNestedScrollChain } from "@/lib/use-nested-scroll-chain";

import { useLocale, useTranslations } from "next-intl";

import { DashboardScroll } from "@/components/dashboard/dashboard-scroll";
import { StatusBadge } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";

import { formatDuration } from "../kpis";
import { automationLabel } from "../label";
import type { AutomationDefinition, AutomationRun } from "../model";
import { buildRunStageNodes } from "../run-stages";
import { runStatusTone } from "../status";
import { RunStagesRail } from "./run-stages-rail";

const cell = "min-w-0 overflow-hidden";

function formatWhen(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AutomationRecentRuns({
  runs,
  automations,
  onView,
  onViewAll,
  compact = false,
  limit,
}: {
  runs: AutomationRun[];
  automations: AutomationDefinition[];
  onView: (runId: string) => void;
  onViewAll?: () => void;
  /** Sit under stretched list/detail without stealing viewport height. */
  compact?: boolean;
  /** Cap visible rows (Overview). Badge still reflects total run count. */
  limit?: number;
}) {
  const t = useTranslations("automation");
  const mobileScrollRef = useRef<HTMLUListElement>(null);
  useNestedScrollChain(mobileScrollRef);
  const locale = useLocale();
  const byId = new Map(automations.map((item) => [item.id, item]));
  const sortedAll = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const sorted =
    typeof limit === "number" ? sortedAll.slice(0, Math.max(0, limit)) : sortedAll;
  const totalCount = sortedAll.length;

  return (
    <section
      className={cn(
        "dashboard-card dashboard-list flex min-w-0 flex-col overflow-hidden",
        compact
          ? "h-full min-h-0"
          : "h-[min(420px,52vh)] min-h-[280px]",
      )}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-[#edf2f8] px-3.5 py-2.5">
        <div className="min-w-0">
          <h2 className="dashboard-card-title">{t("runs.title")}</h2>
          <p className="dashboard-label mt-0.5 text-[11px]">{t("runs.subtitle")}</p>
        </div>
        {onViewAll && totalCount > (limit ?? totalCount) ? (
          <button
            className="action-motion shrink-0 text-[11px] font-semibold text-[#044ce2] hover:underline"
            type="button"
            onClick={onViewAll}
          >
            {t("runs.viewAll")}
          </button>
        ) : null}
      </div>

      {totalCount === 0 ? (
        <p className="px-4 py-8 text-center text-[11px] text-[#98a4b5]">{t("runs.empty")}</p>
      ) : (
        <>
          <div className="hidden min-h-0 min-w-0 flex-1 flex-col md:flex">
            <DashboardScroll scrollClassName="overflow-x-auto overflow-y-auto">
              <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-left text-[11px] xl:min-w-0">
                <colgroup>
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "13%" }} />
                  <col />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: 72 }} />
                </colgroup>
                <thead className="dashboard-list__head">
                  <tr>
                    <th className={cell}>{t("runs.columns.when")}</th>
                    <th className={cell}>{t("runs.columns.automation")}</th>
                    <th className={cell}>{t("runs.columns.trigger")}</th>
                    <th className={cell}>{t("runs.columns.result")}</th>
                    <th className={cell}>{t("runs.columns.stages")}</th>
                    <th className={cell}>{t("runs.columns.duration")}</th>
                    <th className={cell}>{t("runs.columns.status")}</th>
                    <th className={cell} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((run) => {
                    const automation = byId.get(run.automationId);
                    const result = t(run.summaryKey, run.summaryParams);
                    const stages = automation
                      ? buildRunStageNodes(automation.type, run)
                      : [];
                    return (
                      <tr
                        className="soft-row border-b border-[var(--list-divider)]"
                        key={run.id}
                      >
                        <td className={`${cell} px-3 py-2.5 tabular-nums text-[#516078]`}>
                          {formatWhen(run.startedAt, locale)}
                        </td>
                        <td className={`${cell} px-3 py-2.5 font-semibold text-[#24334c]`}>
                          <span className="truncate">
                            {automation ? automationLabel(automation, t) : run.automationId}
                          </span>
                        </td>
                        <td className={`${cell} px-3 py-2.5 text-[#516078]`}>
                          <span className="truncate">{run.trigger}</span>
                        </td>
                        <td className={`${cell} px-3 py-2.5`}>
                          <p className="truncate text-[#516078]" title={result}>
                            {result}
                          </p>
                        </td>
                        <td className={`${cell} px-3 py-2.5`}>
                          {stages.length > 0 ? (
                            <RunStagesRail nodes={stages} />
                          ) : (
                            <span className="tabular-nums text-[#516078]">
                              {run.processed}
                            </span>
                          )}
                        </td>
                        <td className={`${cell} px-3 py-2.5 tabular-nums text-[#516078]`}>
                          {formatDuration(run.durationMs)}
                        </td>
                        <td className={`${cell} px-3 py-2.5`}>
                          <StatusBadge size="xs" tone={runStatusTone[run.status]}>
                            {t(`runStatus.${run.status}`)}
                          </StatusBadge>
                        </td>
                        <td className={`${cell} px-3 py-2.5 text-right`}>
                          <button
                            className="action-motion soft-button h-7 rounded-[8px] px-2 text-[10px] font-semibold text-[#405069]"
                            type="button"
                            onClick={() => onView(run.id)}
                          >
                            {t("runs.view")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DashboardScroll>
          </div>

          <ul ref={mobileScrollRef} className="dashboard-scroll--chain dashboard-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2.5 md:hidden">
            {sorted.map((run) => {
              const automation = byId.get(run.automationId);
              const stages = automation
                ? buildRunStageNodes(automation.type, run)
                : [];
              return (
                <li
                  className="rounded-[10px] border border-[#edf2f8] bg-[#fbfcfe] px-3 py-2.5"
                  key={run.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#24334c]">
                        {automation ? automationLabel(automation, t) : run.automationId}
                      </p>
                      <p className="mt-0.5 text-[10px] tabular-nums text-[#98a4b5]">
                        {formatWhen(run.startedAt, locale)}
                      </p>
                    </div>
                    <StatusBadge size="xs" tone={runStatusTone[run.status]}>
                      {t(`runStatus.${run.status}`)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#516078]">
                    {t(run.summaryKey, run.summaryParams)}
                  </p>
                  {stages.length > 0 ? (
                    <div className="mt-2">
                      <p className="mb-1 text-[10px] font-semibold text-[#98a4b5]">
                        {t("runs.columns.stages")}
                      </p>
                      <RunStagesRail nodes={stages} />
                    </div>
                  ) : null}
                  <button
                    className="action-motion soft-button mt-2 h-8 w-full rounded-[8px] text-[10px] font-semibold text-[#405069]"
                    type="button"
                    onClick={() => onView(run.id)}
                  >
                    {t("runs.view")}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
