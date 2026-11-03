"use client";

import { ArrowLeft, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import { FormSheet } from "@/components/forms/form-sheet";

import { formatDuration } from "../kpis";
import { automationLabel } from "../label";
import type {
  AutomationDefinition,
  AutomationRun,
  AutomationRunActivityAction,
} from "../model";
import { buildRunStageNodes } from "../run-stages";
import { runStatusTone } from "../status";
import { RunActivityTimeline } from "./run-activity-timeline";
import { RunStagesRail } from "./run-stages-rail";

function formatWhen(iso: string | null, locale: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function RunDetailSheet({
  open,
  run,
  automation,
  canGoBack = false,
  onClose,
  onActivityAction,
}: {
  open: boolean;
  run: AutomationRun | null;
  automation: AutomationDefinition | null;
  canGoBack?: boolean;
  onClose: () => void;
  onActivityAction?: (kind: AutomationRunActivityAction) => void;
}) {
  const t = useTranslations("automation");
  const locale = useLocale();

  return (
    <FormSheet
      closeLabel={t("runDetail.close")}
      contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
      open={open}
      showHeader={false}
      title={t("runDetail.title")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[70]"
      onClose={onClose}
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-start gap-2 border-b border-[#edf2f8] px-3.5 py-3">
          {canGoBack ? (
            <button
              aria-label={t("runDetail.back")}
              className="action-motion soft-button mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#516078]"
              type="button"
              onClick={onClose}
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-semibold text-[#063586]">
              {t("runDetail.title")}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-[#7d8aa0]">
              {automation ? automationLabel(automation, t) : t("runs.empty")}
            </p>
          </div>
          <button
            aria-label={t("runDetail.close")}
            className="action-motion soft-button mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#516078]"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          {!run ? (
            <p className="text-[11px] text-[#98a4b5]">{t("runs.empty")}</p>
          ) : (
            <div className="space-y-3 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-semibold text-[#24334c]">
                  {automation ? automationLabel(automation, t) : run.automationId}
                </p>
                <StatusBadge size="xs" tone={runStatusTone[run.status]}>
                  {t(`runStatus.${run.status}`)}
                </StatusBadge>
              </div>

              {automation ? (
                <div className="rounded-[10px] border border-[#edf2f8] px-3 py-2.5">
                  <p className="mb-2 text-[10px] font-semibold tracking-wide text-[#98a4b5] uppercase">
                    {t("runs.columns.stages")}
                  </p>
                  <RunStagesRail
                    nodes={buildRunStageNodes(automation.type, run)}
                  />
                </div>
              ) : null}

              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[#98a4b5] uppercase">
                  {t("runDetail.summary")}
                </p>
                <dl className="space-y-1.5 rounded-[10px] border border-[#edf2f8] px-3 py-2.5 text-[#516078]">
                  <Row label={t("runDetail.trigger")} value={run.trigger} />
                  <Row label={t("runDetail.started")} value={formatWhen(run.startedAt, locale)} />
                  <Row label={t("runDetail.finished")} value={formatWhen(run.finishedAt, locale)} />
                  <Row label={t("runDetail.duration")} value={formatDuration(run.durationMs)} />
                  <Row label={t("runDetail.processed")} value={String(run.processed)} />
                  <Row label={t("runDetail.succeeded")} value={String(run.succeeded)} />
                  <Row label={t("runDetail.skipped")} value={String(run.skipped)} />
                  <Row label={t("runDetail.needsReview")} value={String(run.needsReview)} />
                  <Row label={t("runDetail.failed")} value={String(run.failed)} />
                </dl>
              </div>

              {run.errorSummaryKey ? (
                <p className="rounded-[10px] border border-[#f3d6d2] bg-[#fff7f5] px-3 py-2 text-[#c9564f]">
                  {t(run.errorSummaryKey)}
                </p>
              ) : null}

              <div>
                <p className="mb-2 text-[10px] font-semibold tracking-wide text-[#98a4b5] uppercase">
                  {t("runDetail.activity")}
                </p>
                <RunActivityTimeline run={run} onAction={onActivityAction} />
              </div>
            </div>
          )}
        </div>
      </div>
    </FormSheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right font-medium tabular-nums text-[#24334c]">{value}</dd>
    </div>
  );
}
