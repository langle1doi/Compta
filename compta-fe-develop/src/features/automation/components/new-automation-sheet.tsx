"use client";

import {
  ArrowRight,
  Bell,
  FileText,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/compte/confirm-dialog";
import { IconTile } from "@/components/dashboard/tone";
import { FormSheet } from "@/components/forms/form-sheet";
import { cn } from "@/lib/utils";

import type { AutomationType, ExecutionMode } from "../model";
import {
  buildLivePipeline,
  computeNextRunLabel,
  defaultBankConfig,
  defaultQuoteConfig,
  defaultReminderConfig,
  toStoredConfiguration,
  validateWizardConfig,
  type WizardBankConfig,
  type WizardConfig,
  type WizardQuoteConfig,
  type WizardReminderConfig,
} from "../pipeline";
import { activateAutomationFromTemplate } from "../store";
import {
  BankConfigForm,
  QuoteConfigForm,
  ReminderConfigForm,
} from "./config-forms";
import { PipelinePreview } from "./pipeline-preview";

type Step = "template" | "configure" | "review";

const templates: {
  type: AutomationType;
  icon: LucideIcon;
  tone: "blue" | "orange" | "purple";
  category: "finance" | "sales";
}[] = [
  { type: "bank_reconciliation", icon: Landmark, tone: "blue", category: "finance" },
  { type: "payment_reminders", icon: Bell, tone: "orange", category: "finance" },
  { type: "quote_follow_up", icon: FileText, tone: "purple", category: "sales" },
];

function initialConfig(type: AutomationType): WizardConfig {
  if (type === "bank_reconciliation") return defaultBankConfig();
  if (type === "payment_reminders") return defaultReminderConfig();
  return defaultQuoteConfig();
}

export function NewAutomationSheet({
  open,
  onClose,
  onActivated,
}: {
  open: boolean;
  onClose: () => void;
  onActivated: (id: string) => void;
}) {
  const t = useTranslations("automation");
  const locale = useLocale();
  const [step, setStep] = useState<Step>("template");
  const [type, setType] = useState<AutomationType | null>(null);
  const [config, setConfig] = useState<WizardConfig | null>(null);
  const [error, setError] = useState("");
  const [confirmAuto, setConfirmAuto] = useState(false);

  function reset() {
    setStep("template");
    setType(null);
    setConfig(null);
    setError("");
    setConfirmAuto(false);
  }

  function close() {
    reset();
    onClose();
  }

  const pipelineSteps = useMemo(() => {
    if (!type || !config) return [];
    return buildLivePipeline(type, config);
  }, [config, type]);

  function selectTemplate(next: AutomationType) {
    setType(next);
    setConfig(initialConfig(next));
    setError("");
  }

  function goConfigure() {
    if (!type || !config) {
      setError(t("wizard.errors.template"));
      return;
    }
    setError("");
    setStep("configure");
  }

  function goReview() {
    if (!type || !config) return;
    const invalid = validateWizardConfig(type, config);
    if (invalid) {
      setError(t(invalid));
      return;
    }
    setError("");
    setStep("review");
  }

  function doActivate() {
    if (!type || !config) return;
    const invalid = validateWizardConfig(type, config);
    if (invalid) {
      setError(t(invalid));
      return;
    }
    const executionMode: ExecutionMode =
      type === "bank_reconciliation"
        ? "auto_with_review"
        : (config as WizardReminderConfig | WizardQuoteConfig).mode === "automatic"
          ? "automatic"
          : "suggest_approve";
    const id = activateAutomationFromTemplate({
      type,
      executionMode,
      configuration: toStoredConfiguration(type, config),
      displayName: config.name,
      scheduleTime:
        type === "bank_reconciliation"
          ? (config as WizardBankConfig).time
          : undefined,
    });
    reset();
    onActivated(id);
  }

  function activate() {
    if (!type || !config) return;
    if (type === "bank_reconciliation") {
      doActivate();
      return;
    }
    const mode = (config as WizardReminderConfig | WizardQuoteConfig).mode;
    if (mode === "automatic") {
      setConfirmAuto(true);
      return;
    }
    doActivate();
  }

  return (
    <>
      <FormSheet
        closeLabel={t("detail.close")}
        contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
        description={t("wizard.subtitle")}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {step !== "template" ? (
              <button
                className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
                type="button"
                onClick={() =>
                  setStep(step === "review" ? "configure" : "template")
                }
              >
                {t("wizard.back")}
              </button>
            ) : null}
            {error ? (
              <p className="min-w-0 flex-1 text-[11px] font-semibold text-[#c9564f]">
                {error}
              </p>
            ) : null}
            {step !== "review" ? (
              <button
                className="action-motion soft-primary ml-auto inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-xs font-semibold text-white disabled:opacity-50"
                disabled={step === "template" && !type}
                type="button"
                onClick={() => (step === "template" ? goConfigure() : goReview())}
              >
                {step === "template" ? t("wizard.useTemplate") : t("wizard.continue")}
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                className="action-motion soft-primary ml-auto h-9 rounded-[9px] px-3 text-xs font-semibold text-white"
                type="button"
                onClick={activate}
              >
                {t("wizard.activate")}
              </button>
            )}
          </div>
        }
        open={open}
        title={t("wizard.title")}
        widthClassName="sm:max-w-[720px] md:max-w-[920px] lg:max-w-[1040px]"
        zIndexClassName="z-[70]"
        onClose={close}
      >
        <div className="dashboard-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5">
          <ol className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-[#98a4b5]">
            {(["template", "configure", "review"] as const).map((item, index) => (
              <li
                className={cn(
                  "rounded-full px-2.5 py-1",
                  step === item && "bg-[#e8efff] text-[#044ce2]",
                )}
                key={item}
              >
                {index + 1}. {t(`wizard.steps.${item}`)}
              </li>
            ))}
          </ol>

          {step === "template" ? (
            <div className="grid gap-2.5 md:grid-cols-3">
              {templates.map((item) => {
                const selected = type === item.type;
                return (
                  <button
                    className={cn(
                      "flex min-h-0 flex-col rounded-[14px] border px-3.5 py-3.5 text-left transition-colors",
                      selected
                        ? "border-[#c9d9ff] bg-[#f3f7ff] shadow-[0_0_0_1px_#c9d9ff]"
                        : "border-[#edf2f8] bg-white hover:bg-[#fbfcfe]",
                    )}
                    key={item.type}
                    type="button"
                    onClick={() => selectTemplate(item.type)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <IconTile icon={item.icon} size="sm" tone={item.tone} />
                      <span className="rounded-full bg-[#edf3fb] px-2 py-0.5 text-[10px] font-semibold text-[#516078]">
                        {t(`category.${item.category}`)}
                      </span>
                    </div>
                    <p className="mt-2.5 text-[13px] font-semibold text-[#063586]">
                      {t(`wizard.templates.${item.type}.title`)}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-[#7d8aa0]">
                      {t(`wizard.templates.${item.type}.body`)}
                    </p>
                    <p className="mt-2 text-[10px] leading-4 text-[#516078]">
                      {t(`wizard.templates.${item.type}.flow`)}
                    </p>
                    <span className="mt-3 text-[11px] font-semibold text-[#044ce2]">
                      {t("wizard.useTemplate")}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === "configure" && type && config ? (
            <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <PipelinePreview steps={pipelineSteps} />
              <div className="min-w-0">
                {type === "bank_reconciliation" ? (
                  <BankConfigForm
                    config={config as WizardBankConfig}
                    onChange={setConfig}
                  />
                ) : null}
                {type === "payment_reminders" ? (
                  <ReminderConfigForm
                    config={config as WizardReminderConfig}
                    onChange={setConfig}
                  />
                ) : null}
                {type === "quote_follow_up" ? (
                  <QuoteConfigForm
                    config={config as WizardQuoteConfig}
                    onChange={setConfig}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {step === "review" && type && config ? (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <PipelinePreview steps={pipelineSteps} />
              <div className="space-y-3">
                <div className="space-y-2 rounded-[12px] border border-[#edf2f8] bg-[#fbfcfe] px-3.5 py-3 text-[11px]">
                  <SummaryRow label={t("wizard.summary.name")} value={config.name} />
                  <SummaryRow
                    label={t("wizard.summary.template")}
                    value={t(`wizard.templates.${type}.title`)}
                  />
                  <SummaryRow label={t("wizard.summary.company")} value="DFM-Europe" />
                  {type === "bank_reconciliation" ? (
                    <>
                      <SummaryRow
                        label={t("wizard.summary.trigger")}
                        value={`${t("config.daily")} · ${(config as WizardBankConfig).time}`}
                      />
                      <SummaryRow
                        label={t("wizard.summary.nextRun")}
                        value={computeNextRunLabel(
                          (config as WizardBankConfig).time,
                          locale,
                        )}
                      />
                      <SummaryRow
                        label={t("wizard.summary.mode")}
                        value={t("mode.autoWithReview")}
                      />
                    </>
                  ) : null}
                  {type === "payment_reminders" ? (
                    <SummaryRow
                      label={t("wizard.summary.mode")}
                      value={t(
                        (config as WizardReminderConfig).mode === "automatic"
                          ? "mode.automatic"
                          : "mode.suggestApprove",
                      )}
                    />
                  ) : null}
                  {type === "quote_follow_up" ? (
                    <>
                      <SummaryRow
                        label={t("wizard.summary.trigger")}
                        value={`${(config as WizardQuoteConfig).noResponseDays}d / ${(config as WizardQuoteConfig).daysBeforeExpiry}d`}
                      />
                      <SummaryRow
                        label={t("wizard.summary.mode")}
                        value={t(
                          (config as WizardQuoteConfig).mode === "automatic"
                            ? "mode.automatic"
                            : "mode.suggestApprove",
                        )}
                      />
                    </>
                  ) : null}
                </div>
                <p className="rounded-[10px] border border-[#f3e2c8] bg-[#fff9f0] px-3 py-2.5 text-[11px] leading-5 text-[#b96d24]">
                  {t("wizard.autoWarning")}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </FormSheet>

      <ConfirmDialog
        body={t("confirm.modeBody")}
        cancelLabel={t("confirm.cancel")}
        confirmLabel={t("wizard.activate")}
        open={confirmAuto}
        title={t("confirm.modeTitle")}
        onCancel={() => setConfirmAuto(false)}
        onConfirm={() => {
          setConfirmAuto(false);
          doActivate();
        }}
      />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-start justify-between gap-3">
      <span className="text-[#98a4b5]">{label}</span>
      <span className="text-right font-medium text-[#405069]">{value}</span>
    </p>
  );
}
