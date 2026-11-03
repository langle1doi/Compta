"use client";

import {
  Bell,
  FileText,
  Landmark,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";
import { ConfirmDialog } from "@/components/compte/confirm-dialog";
import { IconTile, StatusBadge } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";
import type { Tone } from "@/mocks/dashboard/types";

import { formatDuration } from "../kpis";
import { automationLabel } from "../label";
import type {
  AutomationDefinition,
  AutomationRun,
} from "../model";
import {
  buildLivePipeline,
  configFromRecord,
  toStoredConfiguration,
  validateWizardConfig,
  type WizardBankConfig,
  type WizardConfig,
  type WizardQuoteConfig,
  type WizardReminderConfig,
} from "../pipeline";
import {
  automationStatusTone,
  executionModeLabelKey,
  runStatusTone,
} from "../status";
import {
  pauseAutomation,
  resumeAutomation,
  setAutomationExecutionMode,
  updateAutomationConfiguration,
} from "../store";
import {
  BankConfigForm,
  QuoteConfigForm,
  ReminderConfigForm,
} from "./config-forms";
import { PipelinePreview } from "./pipeline-preview";
import { RunActivityTimeline } from "./run-activity-timeline";

const typeIcon: Record<AutomationDefinition["type"], LucideIcon> = {
  bank_reconciliation: Landmark,
  payment_reminders: Bell,
  quote_follow_up: FileText,
};

const typeTone: Record<AutomationDefinition["type"], Tone> = {
  bank_reconciliation: "blue",
  payment_reminders: "orange",
  quote_follow_up: "purple",
};

type DetailTab = "overview" | "history" | "settings" | "logs";

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

export function AutomationDetail({
  automation,
  runs,
  canManage,
  onViewRun,
  onClose,
}: {
  automation: AutomationDefinition | null;
  runs: AutomationRun[];
  canManage: boolean;
  onViewRun: (runId: string) => void;
  onClose?: () => void;
}) {
  const t = useTranslations("automation");
  const locale = useLocale();
  const [tab, setTab] = useState<DetailTab>("overview");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<DetailTab | null>(null);
  const [settingsKey, setSettingsKey] = useState(0);

  const automationRuns = useMemo(
    () =>
      runs
        .filter((run) => automation && run.automationId === automation.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [automation, runs],
  );
  const latestRun = automationRuns[0] ?? null;

  if (!automation) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-1 px-4 text-center">
        <p className="text-sm font-semibold text-[#24334c]">{t("detail.emptyTitle")}</p>
        <p className="max-w-[32ch] text-[11px] leading-5 text-[#7d8aa0]">
          {t("detail.emptyBody")}
        </p>
      </div>
    );
  }

  const Icon = typeIcon[automation.type];
  const tabs: DetailTab[] = ["overview", "history", "settings", "logs"];
  const active = automation.status === "active";

  function onToggle() {
    if (!canManage) return;
    if (active) pauseAutomation(automation!.id);
    else resumeAutomation(automation!.id);
  }

  function requestTab(next: DetailTab) {
    if (next === tab) return;
    if (tab === "settings" && settingsDirty) {
      setPendingTab(next);
      return;
    }
    setTab(next);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[#edf2f8] px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <IconTile icon={Icon} size="sm" tone={typeTone[automation.type]} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[#063586]">
                {automationLabel(automation, t)}
              </h3>
              <StatusBadge size="xs" tone={automationStatusTone[automation.status]}>
                {t(`status.${automation.status}`)}
              </StatusBadge>
            </div>
            <p className="mt-0.5 line-clamp-3 text-[11px] leading-4 break-words text-[#7d8aa0]">
              {t(automation.descriptionKey)}
            </p>
            <p className="mt-1 text-[10px] text-[#98a4b5]">
              {t("detail.company", { company: automation.companyName })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            {canManage ? (
              <label className="flex items-center gap-1.5">
                <span className="sr-only">
                  {active ? t("detail.pause") : t("detail.resume")}
                </span>
                <button
                  aria-checked={active}
                  aria-label={active ? t("detail.pause") : t("detail.resume")}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    active ? "bg-[#044ce2]" : "bg-[#d7deea]",
                  )}
                  role="switch"
                  type="button"
                  onClick={onToggle}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                      active && "translate-x-4",
                    )}
                  />
                </button>
              </label>
            ) : null}
            {onClose ? (
              <button
                aria-label={t("detail.close")}
                className="action-motion soft-button grid h-8 w-8 place-items-center rounded-[8px] text-[#516078]"
                type="button"
                onClick={onClose}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <AnimatedSelectionGroup className="mt-2 min-w-0" id="automation-detail-tabs">
          <div
            aria-label={t("detail.tabsLabel")}
            className="dashboard-scroll flex min-w-0 gap-0.5 overflow-x-auto py-1"
            role="tablist"
          >
            {tabs.map((item) => {
              const selected = tab === item;
              return (
                <button
                  aria-selected={selected}
                  className={cn(
                    "relative shrink-0 rounded-full px-2.5 py-2 text-[11px] font-semibold whitespace-nowrap transition-colors xl:flex-1 xl:px-2",
                    selected ? "text-[#2458d6]" : "text-[#7d8aa0] hover:text-[#405069]",
                  )}
                  key={item}
                  role="tab"
                  type="button"
                  onClick={() => requestTab(item)}
                >
                  {selected ? (
                    <AnimatedActiveIndicator
                      className="rounded-full"
                      layoutId="automation-detail-tab"
                      variant="soft-pill"
                    />
                  ) : null}
                  <span className="relative z-[1]">{t(`detail.tabs.${item}`)}</span>
                </button>
              );
            })}
          </div>
        </AnimatedSelectionGroup>
      </header>

      {tab === "overview" ? (
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-3.5 py-3"
          style={{ animation: "compte-tab-in 160ms ease-out" }}
        >
          <div className="mb-3 grid shrink-0 grid-cols-2 gap-x-3 gap-y-1 rounded-[10px] border border-[#edf2f8] px-2.5 py-2 text-[10px] sm:grid-cols-4">
            <MetaChip label={t("detail.trigger")} value={t(automation.triggerLabelKey)} />
            <MetaChip
              label={t("detail.mode")}
              value={t(executionModeLabelKey(automation.executionMode))}
            />
            <MetaChip label={t("detail.lastRun")} value={formatWhen(automation.lastRunAt, locale)} />
            <MetaChip label={t("detail.nextRun")} value={formatWhen(automation.nextRunAt, locale)} />
          </div>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-0.5">
              <h4 className="text-[11px] font-semibold text-[#24334c]">{t("detail.workflow")}</h4>
              {latestRun ? (
                <StatusBadge size="xs" tone={runStatusTone[latestRun.status]}>
                  {t(`runStatus.${latestRun.status}`)}
                </StatusBadge>
              ) : null}
            </div>
            <div className="automation-workflow-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <PipelinePreview
                steps={buildLivePipeline(
                  automation.type,
                  configFromRecord(
                    automation.type,
                    automation.configuration,
                    automationLabel(automation, t),
                  ),
                )}
                stretch
              />
            </div>
          </section>
        </div>
      ) : (
      <div className="automation-detail-scroll dashboard-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        {tab === "history" ? (
          <div style={{ animation: "compte-tab-in 160ms ease-out" }}>
            {automationRuns.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-[#98a4b5]">{t("detail.noRuns")}</p>
            ) : (
              <ul className="space-y-2">
                {automationRuns.map((run) => (
                  <li
                    className="rounded-[10px] border border-[#edf2f8] px-3 py-2.5"
                    key={run.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#24334c] tabular-nums">
                          {formatWhen(run.startedAt, locale)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#7d8aa0]">{run.trigger}</p>
                        <p className="mt-1 text-[10px] text-[#516078]">
                          {t(run.summaryKey, run.summaryParams)}
                        </p>
                      </div>
                      <StatusBadge size="xs" tone={runStatusTone[run.status]}>
                        {t(`runStatus.${run.status}`)}
                      </StatusBadge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] tabular-nums text-[#98a4b5]">
                        {formatDuration(run.durationMs)}
                      </p>
                      <button
                        className="action-motion soft-button h-7 rounded-[8px] px-2 text-[10px] font-semibold text-[#405069]"
                        type="button"
                        onClick={() => onViewRun(run.id)}
                      >
                        {t("detail.viewRun")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            <SettingsPanel
              key={`${automation.id}-${settingsKey}`}
              automation={automation}
              canManage={canManage}
              onDirtyChange={setSettingsDirty}
            />
          </div>
        ) : null}

        {tab === "logs" ? (
          <div style={{ animation: "compte-tab-in 160ms ease-out" }}>
            {latestRun ? (
              <div className="space-y-2">
                <p className="text-[10px] text-[#7d8aa0]">{t("detail.logsHint")}</p>
                <RunActivityTimeline compact run={latestRun} />
              </div>
            ) : (
              <p className="py-6 text-center text-[11px] text-[#98a4b5]">{t("detail.noRuns")}</p>
            )}
          </div>
        ) : null}
      </div>
      )}

      <ConfirmDialog
        body={t("settingsPanel.discardBody")}
        cancelLabel={t("settingsPanel.keepEditing")}
        confirmLabel={t("settingsPanel.discard")}
        open={pendingTab !== null}
        title={t("settingsPanel.discardTitle")}
        onCancel={() => setPendingTab(null)}
        onConfirm={() => {
          if (pendingTab) setTab(pendingTab);
          setPendingTab(null);
          setSettingsDirty(false);
          setSettingsKey((value) => value + 1);
        }}
      />
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] font-semibold tracking-wide text-[#98a4b5] uppercase">
        {label}
      </p>
      <p className="truncate font-medium text-[#405069]" title={value}>
        {value}
      </p>
    </div>
  );
}

function SettingsPanel({
  automation,
  canManage,
  onDirtyChange,
}: {
  automation: AutomationDefinition;
  canManage: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const t = useTranslations("automation");
  const [draft, setDraft] = useState<WizardConfig>(() =>
    configFromRecord(
      automation.type,
      automation.configuration,
      automationLabel(automation, t),
    ),
  );
  const [baseline, setBaseline] = useState<WizardConfig>(() =>
    configFromRecord(
      automation.type,
      automation.configuration,
      automationLabel(automation, t),
    ),
  );
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [pendingAuto, setPendingAuto] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function cancel() {
    setDraft(baseline);
    setError("");
    setSavedNotice(false);
  }

  function applySave() {
    const invalid = validateWizardConfig(automation.type, draft);
    if (invalid) {
      setError(t(invalid));
      return;
    }
    const stored = toStoredConfiguration(automation.type, draft);
    updateAutomationConfiguration(automation.id, stored);
    if (automation.type === "bank_reconciliation") {
      setAutomationExecutionMode(automation.id, "auto_with_review");
    } else {
      const mode = (draft as WizardReminderConfig | WizardQuoteConfig).mode;
      if (mode !== automation.executionMode) {
        setAutomationExecutionMode(
          automation.id,
          mode === "automatic" ? "automatic" : "suggest_approve",
        );
      }
    }
    setBaseline(draft);
    setError("");
    setSavedNotice(true);
  }

  function needsAutoConfirm() {
    if (automation.type === "bank_reconciliation") return false;
    const next = (draft as WizardReminderConfig | WizardQuoteConfig).mode;
    const prev = (baseline as WizardReminderConfig | WizardQuoteConfig).mode;
    return next === "automatic" && prev !== "automatic";
  }

  function save() {
    if (!canManage || !dirty) return;
    if (needsAutoConfirm()) {
      setPendingAuto(true);
      return;
    }
    applySave();
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-[1] flex flex-wrap items-start justify-between gap-2 rounded-[10px] border border-[#edf2f8] bg-white/95 px-3 py-2.5 backdrop-blur-sm">
        <div className="min-w-0">
          <h4 className="text-[12px] font-semibold text-[#063586]">
            {t("settingsPanel.title")}
          </h4>
          <p className="mt-0.5 text-[10px] text-[#7d8aa0]">
            {t("settingsPanel.helper")}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#405069] disabled:opacity-50"
              disabled={!dirty}
              type="button"
              onClick={cancel}
            >
              {t("settingsPanel.cancel")}
            </button>
            <button
              className="action-motion soft-primary h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-white disabled:opacity-50"
              disabled={!dirty}
              type="button"
              onClick={save}
            >
              {t("settingsPanel.save")}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-[11px] font-semibold text-[#c9564f]">{error}</p>
      ) : null}
      {savedNotice ? (
        <p className="text-[11px] font-semibold text-[#238567]">
          {t("settingsPanel.saved")}
        </p>
      ) : null}

      <div className="min-w-0">
        {automation.type === "bank_reconciliation" ? (
          <BankConfigForm
            config={draft as WizardBankConfig}
            disabled={!canManage}
            onChange={setDraft}
          />
        ) : null}
        {automation.type === "payment_reminders" ? (
          <ReminderConfigForm
            config={draft as WizardReminderConfig}
            disabled={!canManage}
            onChange={setDraft}
          />
        ) : null}
        {automation.type === "quote_follow_up" ? (
          <QuoteConfigForm
            config={draft as WizardQuoteConfig}
            disabled={!canManage}
            onChange={setDraft}
          />
        ) : null}
      </div>

      <ConfirmDialog
        body={
          automation.type === "bank_reconciliation"
            ? t("confirm.bankAutoBody")
            : t("confirm.modeBody")
        }
        cancelLabel={t("confirm.cancel")}
        confirmLabel={
          automation.type === "bank_reconciliation"
            ? t("confirm.bankAutoConfirm")
            : t("confirm.confirmMode")
        }
        open={pendingAuto}
        title={
          automation.type === "bank_reconciliation"
            ? t("confirm.bankAutoTitle")
            : t("confirm.modeTitle")
        }
        onCancel={() => setPendingAuto(false)}
        onConfirm={() => {
          setPendingAuto(false);
          applySave();
        }}
      />
    </div>
  );
}
