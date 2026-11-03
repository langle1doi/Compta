"use client";

import { Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { SoftSelect } from "@/components/compte/soft-select";
import { SoftTimePicker } from "@/components/compte/soft-time-picker";
import { FormSheet } from "@/components/forms/form-sheet";
import { cn } from "@/lib/utils";

import {
  computeNextRunLabel,
  type ReminderStageConfig,
  type WizardBankConfig,
  type WizardQuoteConfig,
  type WizardReminderConfig,
} from "../pipeline";

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-[14px] border border-[#e8eef6] bg-white px-3.5 py-3.5 shadow-[0_1px_0_rgba(36,51,76,0.02)]",
        className,
      )}
    >
      <h4 className="text-[11px] font-semibold tracking-wide text-[#98a4b5] uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

function HelperLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] leading-4 text-[#7d8aa0]">{children}</p>
  );
}

function Field({
  label,
  helper,
  required,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="block min-w-0 text-[11px]">
      <span className="font-semibold text-[#24334c]">
        {label}
        {required ? <span className="text-[#044ce2]"> *</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {helper ? (
        <p className="mt-1.5 text-[10px] leading-4 text-[#7d8aa0]">{helper}</p>
      ) : null}
    </div>
  );
}

/** Derived / contextual information — never a form control. */
function DerivedInfo({
  label,
  value,
  helper,
  badge,
}: {
  label: string;
  value: string;
  helper?: string;
  badge?: string;
}) {
  return (
    <div className="rounded-[12px] border border-[#e8eef6] bg-[#f7faff] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Info aria-hidden="true" className="h-3.5 w-3.5 text-[#7d8aa0]" />
        <p className="text-[10px] font-semibold tracking-wide text-[#98a4b5] uppercase">
          {label}
        </p>
        {badge ? (
          <span className="rounded-full bg-[#e8efff] px-1.5 py-0.5 text-[9px] font-semibold text-[#044ce2]">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[12px] font-semibold text-[#24334c]">{value}</p>
      {helper ? (
        <p className="mt-0.5 text-[10px] leading-4 text-[#7d8aa0]">{helper}</p>
      ) : null}
    </div>
  );
}

function SoftSwitch({
  checked,
  disabled,
  label,
  helper,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  helper?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-[10px] border border-[#edf2f8] bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[#24334c]">{label}</p>
        {helper ? (
          <p className="mt-0.5 text-[10px] leading-4 text-[#7d8aa0]">{helper}</p>
        ) : null}
      </div>
      <button
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-[#044ce2]" : "bg-[#cfd8e6]",
          disabled && "cursor-not-allowed opacity-50",
        )}
        disabled={disabled}
        role="switch"
        type="button"
        onClick={() => onChange(!checked)}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}

function ModeCards({
  value,
  disabled,
  onChange,
  automaticLabel,
  suggestLabel,
  automaticHelper,
  suggestHelper,
  groupLabel,
}: {
  value: "automatic" | "suggest_approve";
  disabled?: boolean;
  onChange: (next: "automatic" | "suggest_approve") => void;
  automaticLabel: string;
  suggestLabel: string;
  automaticHelper: string;
  suggestHelper: string;
  groupLabel: string;
}) {
  return (
    <div
      aria-label={groupLabel}
      className="grid gap-2 sm:grid-cols-2"
      role="radiogroup"
    >
      {(
        [
          ["suggest_approve", suggestLabel, suggestHelper],
          ["automatic", automaticLabel, automaticHelper],
        ] as const
      ).map(([mode, label, helper]) => {
        const selected = value === mode;
        return (
          <label
            className={cn(
              "cursor-pointer rounded-[12px] border px-3 py-3 text-left transition-colors",
              selected
                ? "border-[#044ce2] bg-[#f3f7ff] shadow-[0_0_0_1px_rgba(4,76,226,0.12)]"
                : "border-[#e1e7f1] bg-white hover:border-[#c9d9ff]",
              disabled && "cursor-not-allowed opacity-60",
            )}
            key={mode}
          >
            <input
              checked={selected}
              className="sr-only"
              disabled={disabled}
              name={groupLabel}
              type="radio"
              value={mode}
              onChange={() => onChange(mode)}
            />
            <span className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
                  selected
                    ? "border-[#044ce2] bg-[#044ce2]"
                    : "border-[#c5d0e0] bg-white",
                )}
              >
                {selected ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-[#063586]">
                  {label}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-[#7d8aa0]">
                  {helper}
                </span>
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function SoftCheckbox({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-[9px] border border-[#edf2f8] bg-white px-3 py-2 text-[11px] font-semibold text-[#24334c]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        checked={checked}
        className="h-3.5 w-3.5 accent-[#044ce2]"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function PreviewSheet({
  open,
  title,
  to,
  subject,
  body,
  onClose,
}: {
  open: boolean;
  title: string;
  to: string;
  subject: string;
  body: string;
  onClose: () => void;
}) {
  const t = useTranslations("automation");
  return (
    <FormSheet
      closeLabel={t("detail.close")}
      description={t("preview.noSend")}
      open={open}
      title={title}
      widthClassName="sm:max-w-[480px]"
      zIndexClassName="z-[120]"
      onClose={onClose}
    >
      <div className="dashboard-scroll space-y-3 overflow-y-auto px-4 py-4">
        <DerivedInfo label={t("preview.to")} value={to} />
        <DerivedInfo label={t("preview.subject")} value={subject} />
        <div className="rounded-[12px] border border-[#e8eef6] bg-white px-3.5 py-3">
          <p className="text-[10px] font-semibold tracking-wide text-[#98a4b5] uppercase">
            {t("preview.body")}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-[#405069]">
            {body}
          </p>
        </div>
      </div>
    </FormSheet>
  );
}

const inputClass =
  "soft-input h-9 w-full min-w-0 rounded-[9px] !bg-white px-2.5 text-xs font-medium text-[#24334c] outline-none";

export function BankConfigForm({
  config,
  disabled,
  onChange,
}: {
  config: WizardBankConfig;
  disabled?: boolean;
  onChange: (next: WizardBankConfig) => void;
}) {
  const t = useTranslations("automation");
  const locale = useLocale();
  const reviewerLabel =
    config.reviewerId === "accountant"
      ? t("config.accountant")
      : t("config.accountingTeam");

  if (disabled) {
    return (
      <div className="space-y-3">
        <p className="rounded-[10px] border border-[#e8eef6] bg-[#f7faff] px-3 py-2 text-[11px] text-[#516078]">
          {t("settingsPanel.readOnly")}
        </p>
        <DerivedInfo label={t("config.name")} value={config.name} />
        <DerivedInfo
          helper={t("config.demoWarning")}
          label={t("config.source")}
          value={t("config.demoTransactions")}
          badge={t("config.demoBadge")}
        />
        <DerivedInfo
          helper={config.timezone}
          label={t("settings.time")}
          value={config.time}
        />
        <DerivedInfo label={t("config.assignReview")} value={reviewerLabel} />
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Section className="lg:col-span-2" title={t("config.general")}>
        <Field helper={t("config.nameHelper")} label={t("config.name")} required>
          <input
            className={inputClass}
            value={config.name}
            onChange={(event) =>
              onChange({ ...config, name: event.target.value })
            }
          />
        </Field>
      </Section>

      <Section title={t("config.bankSource")}>
        <DerivedInfo
          badge={t("config.demoBadge")}
          helper={t("config.demoWarning")}
          label={t("config.currentSource")}
          value={t("config.demoTransactions")}
        />
        <DerivedInfo
          label={t("config.openBanking")}
          value={t("config.openBankingNotConnected")}
        />
        <button
          className="action-motion soft-button h-9 w-full rounded-[9px] px-3 text-xs font-semibold text-[#044ce2]"
          type="button"
          onClick={() => {
            window.alert(t("config.connectBankSoon"));
          }}
        >
          {t("config.connectBank")}
        </button>
      </Section>

      <Section title={t("config.schedule")}>
        <HelperLine>{t("config.dailyHelper")}</HelperLine>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field helper={t("config.runTimeHelper")} label={t("settings.time")} required>
            <SoftTimePicker
              hourLabel={t("config.hour")}
              hideLabel
              label={t("settings.time")}
              locale={locale}
              minuteLabel={t("config.minute")}
              value={config.time}
              onChange={(time) => onChange({ ...config, time })}
            />
          </Field>
          <Field helper={t("config.timezoneHelper")} label={t("config.timezone")} required>
            <SoftSelect
              hideLabel
              label={t("config.timezone")}
              options={[
                { value: "Europe/Paris", label: "Europe/Paris (CET)" },
                { value: "Europe/Brussels", label: "Europe/Brussels (CET)" },
                { value: "UTC", label: "UTC" },
              ]}
              value={config.timezone}
              onChange={(timezone) => onChange({ ...config, timezone })}
            />
          </Field>
        </div>
        <DerivedInfo
          helper={config.timezone}
          label={t("config.nextRun")}
          value={computeNextRunLabel(config.time, locale)}
        />
      </Section>

      <Section className="lg:col-span-2" title={t("config.reviewNotifications")}>
        <HelperLine>{t("config.reviewUncertainHelper")}</HelperLine>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            helper={t("config.assignReviewHelper")}
            label={t("config.assignReview")}
            required
          >
            <SoftSelect
              hideLabel
              label={t("config.assignReview")}
              options={[
                { value: "accounting_team", label: t("config.accountingTeam") },
                { value: "accountant", label: t("config.accountant") },
              ]}
              value={config.reviewerId}
              onChange={(reviewerId) =>
                onChange({
                  ...config,
                  reviewerId:
                    reviewerId === "accountant"
                      ? "accountant"
                      : "accounting_team",
                })
              }
            />
          </Field>
          <div className="space-y-2">
            <SoftSwitch
              checked={config.notifyReviewers}
              helper={t("config.notifyReviewersHelper")}
              label={t("config.notifyReviewers")}
              onChange={(notifyReviewers) =>
                onChange({ ...config, notifyReviewers })
              }
            />
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-[#24334c]">
                {t("config.channels")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <SoftCheckbox
                  checked={config.notifyInApp}
                  disabled={!config.notifyReviewers}
                  label={t("config.notifyInApp")}
                  onChange={(notifyInApp) =>
                    onChange({ ...config, notifyInApp })
                  }
                />
                <SoftCheckbox
                  checked={config.notifyEmail}
                  disabled={!config.notifyReviewers}
                  label={t("config.notifyEmailChannel")}
                  onChange={(notifyEmail) =>
                    onChange({ ...config, notifyEmail })
                  }
                />
              </div>
            </div>
            <SoftSwitch
              checked={config.autoCloseReview}
              helper={t("config.autoCloseReviewHelper")}
              label={t("config.autoCloseReview")}
              onChange={(autoCloseReview) =>
                onChange({ ...config, autoCloseReview })
              }
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

function ReminderStageRow({
  index,
  stage,
  disabled,
  onChange,
}: {
  index: number;
  stage: ReminderStageConfig;
  disabled?: boolean;
  onChange: (next: ReminderStageConfig) => void;
}) {
  const t = useTranslations("automation");

  return (
    <div
      className={cn(
        "grid gap-2.5 rounded-[12px] border bg-white px-3 py-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] sm:items-end",
        stage.enabled ? "border-[#c9d9ff]" : "border-[#edf2f8]",
      )}
    >
      <SoftSwitch
        checked={stage.enabled}
        disabled={disabled}
        label={t("config.stageN", { n: index + 1 })}
        onChange={(enabled) => onChange({ ...stage, enabled })}
      />
      <Field label={t("config.whenDays")} required>
        <input
          className={inputClass}
          disabled={disabled || !stage.enabled}
          min={0}
          type="number"
          value={stage.days}
          onChange={(event) =>
            onChange({
              ...stage,
              days: Math.max(0, Number(event.target.value) || 0),
            })
          }
        />
      </Field>
      <SoftSelect
        disabled={disabled || !stage.enabled}
        label={t("config.relativeTo")}
        options={[
          { value: "before_due", label: t("config.beforeDue") },
          { value: "after_due", label: t("config.afterDue") },
        ]}
        value={stage.relative}
        onChange={(relative) =>
          onChange({
            ...stage,
            relative: relative === "before_due" ? "before_due" : "after_due",
          })
        }
      />
      <SoftSelect
        disabled={disabled || !stage.enabled}
        label={t("config.tone")}
        options={[
          { value: "gentle", label: t("config.toneGentle") },
          { value: "standard", label: t("config.toneStandard") },
          { value: "firm", label: t("config.toneFirm") },
          { value: "final", label: t("config.toneFinal") },
        ]}
        value={stage.tone}
        onChange={(tone) =>
          onChange({
            ...stage,
            tone:
              tone === "gentle" ||
              tone === "standard" ||
              tone === "firm" ||
              tone === "final"
                ? tone
                : stage.tone,
          })
        }
      />
    </div>
  );
}

export function ReminderConfigForm({
  config,
  disabled,
  onChange,
}: {
  config: WizardReminderConfig;
  disabled?: boolean;
  onChange: (next: WizardReminderConfig) => void;
}) {
  const t = useTranslations("automation");
  const [previewOpen, setPreviewOpen] = useState(false);

  if (disabled) {
    return (
      <div className="space-y-3">
        <p className="rounded-[10px] border border-[#e8eef6] bg-[#f7faff] px-3 py-2 text-[11px] text-[#516078]">
          {t("settingsPanel.readOnly")}
        </p>
        <DerivedInfo label={t("config.name")} value={config.name} />
        <DerivedInfo
          label={t("settings.mode")}
          value={
            config.mode === "automatic"
              ? t("mode.automatic")
              : t("mode.suggestApprove")
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <Section title={t("config.general")}>
          <Field label={t("config.name")} required>
            <input
              className={inputClass}
              value={config.name}
              onChange={(event) =>
                onChange({ ...config, name: event.target.value })
              }
            />
          </Field>
        </Section>

        <Section title={t("settings.mode")}>
          <ModeCards
            automaticHelper={t("config.modeAutomaticHelper")}
            automaticLabel={t("mode.automatic")}
            groupLabel={t("settings.mode")}
            suggestHelper={t("config.modeSuggestHelper")}
            suggestLabel={t("mode.suggestApprove")}
            value={config.mode}
            onChange={(mode) => onChange({ ...config, mode })}
          />
        </Section>

        <Section className="md:col-span-2" title={t("settings.reminderSchedule")}>
          <HelperLine>{t("config.reminderScheduleHelper")}</HelperLine>
          <div className="space-y-2.5">
            {config.stages.map((stage, index) => (
              <ReminderStageRow
                index={index}
                key={stage.id}
                stage={stage}
                onChange={(next) =>
                  onChange({
                    ...config,
                    stages: config.stages.map((item) =>
                      item.id === next.id ? next : item,
                    ),
                  })
                }
              />
            ))}
          </div>
        </Section>

        <Section title={t("config.delivery")}>
          <Field helper={t("config.templateHelper")} label={t("config.template")} required>
            <SoftSelect
              hideLabel
              label={t("config.template")}
              options={[
                {
                  value: "reminder_default",
                  label: t("config.reminderTemplate"),
                },
                { value: "reminder_firm", label: t("config.reminderTemplateFirm") },
                {
                  value: "reminder_final",
                  label: t("config.reminderTemplateFinal"),
                },
              ]}
              value={config.templateId}
              onChange={(templateId) =>
                onChange({
                  ...config,
                  templateId:
                    templateId === "reminder_firm" ||
                    templateId === "reminder_final"
                      ? templateId
                      : "reminder_default",
                })
              }
            />
          </Field>
          <SoftSelect
            label={`${t("config.language")} *`}
            options={[
              { value: "customer", label: t("config.customerLanguage") },
              { value: "en", label: "English" },
              { value: "fr", label: "Français" },
            ]}
            value={config.languageMode}
            onChange={(languageMode) =>
              onChange({
                ...config,
                languageMode:
                  languageMode === "en" || languageMode === "fr"
                    ? languageMode
                    : "customer",
              })
            }
          />
          <button
            className="action-motion soft-button h-9 w-full rounded-[9px] px-3 text-xs font-semibold text-[#044ce2]"
            type="button"
            onClick={() => setPreviewOpen(true)}
          >
            {t("preview.email")}
          </button>
        </Section>

        <Section title={t("config.recipient")}>
          <Field helper={t("config.recipientHelper")} label={t("config.recipient")} required>
            <SoftSelect
              hideLabel
              label={t("config.recipient")}
              options={[
                { value: "billing_contact", label: t("config.billingContact") },
                { value: "primary_contact", label: t("config.primaryContact") },
              ]}
              value={config.recipient}
              onChange={(recipient) =>
                onChange({
                  ...config,
                  recipient:
                    recipient === "primary_contact"
                      ? "primary_contact"
                      : "billing_contact",
                })
              }
            />
          </Field>
          <DerivedInfo label={t("config.channel")} value={t("config.email")} />
        </Section>

        <Section className="md:col-span-2" title={t("config.notifications")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <SoftSwitch
              checked={config.notifyOwnerOnSend}
              label={t("config.notifyOwnerOnSend")}
              onChange={(notifyOwnerOnSend) =>
                onChange({ ...config, notifyOwnerOnSend })
              }
            />
            <SoftSwitch
              checked={config.notifyAccountantOnFail}
              label={t("config.notifyAccountantOnFail")}
              onChange={(notifyAccountantOnFail) =>
                onChange({ ...config, notifyAccountantOnFail })
              }
            />
          </div>
          <HelperLine>{t("config.stopWhenPaidHelper")}</HelperLine>
        </Section>
      </div>

      {previewOpen ? (
        <PreviewSheet
          body={t("preview.reminderBody")}
          open={previewOpen}
          subject={t("preview.reminderSubject")}
          title={t("preview.email")}
          to={t("preview.reminderTo")}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}

export function QuoteConfigForm({
  config,
  disabled,
  onChange,
}: {
  config: WizardQuoteConfig;
  disabled?: boolean;
  onChange: (next: WizardQuoteConfig) => void;
}) {
  const t = useTranslations("automation");
  const [previewOpen, setPreviewOpen] = useState(false);

  if (disabled) {
    return (
      <div className="space-y-3">
        <p className="rounded-[10px] border border-[#e8eef6] bg-[#f7faff] px-3 py-2 text-[11px] text-[#516078]">
          {t("settingsPanel.readOnly")}
        </p>
        <DerivedInfo label={t("config.name")} value={config.name} />
        <DerivedInfo
          label={t("config.action")}
          value={
            config.action === "notify_salesperson"
              ? t("config.notifySalesperson")
              : t("config.prepareFollowUp")
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <Section title={t("config.general")}>
          <Field label={t("config.name")} required>
            <input
              className={inputClass}
              value={config.name}
              onChange={(event) =>
                onChange({ ...config, name: event.target.value })
              }
            />
          </Field>
          <HelperLine>{t("config.quoteEligibleHelper")}</HelperLine>
        </Section>

        <Section title={t("settings.mode")}>
          <ModeCards
            automaticHelper={t("config.modeAutomaticHelper")}
            automaticLabel={t("mode.automatic")}
            groupLabel={t("settings.mode")}
            suggestHelper={t("config.modeSuggestHelper")}
            suggestLabel={t("mode.suggestApprove")}
            value={config.mode}
            onChange={(mode) => onChange({ ...config, mode })}
          />
        </Section>

        <Section className="md:col-span-2" title={t("config.quoteTriggers")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-[12px] border border-[#c9d9ff] bg-white px-3 py-3">
              <SoftSwitch
                checked={config.noResponseEnabled}
                helper={t("config.noResponseHelper")}
                label={t("config.enableNoResponse")}
                onChange={(noResponseEnabled) =>
                  onChange({ ...config, noResponseEnabled })
                }
              />
              <Field label={t("settings.noResponseDays")} required>
                <input
                  className={inputClass}
                  disabled={!config.noResponseEnabled}
                  min={1}
                  type="number"
                  value={config.noResponseDays}
                  onChange={(event) =>
                    onChange({
                      ...config,
                      noResponseDays: Math.max(
                        1,
                        Number(event.target.value) || 1,
                      ),
                    })
                  }
                />
              </Field>
            </div>
            <div className="space-y-2 rounded-[12px] border border-[#c9d9ff] bg-white px-3 py-3">
              <SoftSwitch
                checked={config.expiryEnabled}
                helper={t("config.expiryHelper")}
                label={t("config.enableExpiry")}
                onChange={(expiryEnabled) =>
                  onChange({ ...config, expiryEnabled })
                }
              />
              <Field label={t("settings.beforeExpirationDays")} required>
                <input
                  className={inputClass}
                  disabled={!config.expiryEnabled}
                  min={1}
                  type="number"
                  value={config.daysBeforeExpiry}
                  onChange={(event) =>
                    onChange({
                      ...config,
                      daysBeforeExpiry: Math.max(
                        1,
                        Number(event.target.value) || 1,
                      ),
                    })
                  }
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section className="md:col-span-2" title={t("config.quoteAction")}>
          <div
            aria-label={t("config.quoteAction")}
            className="grid gap-2 sm:grid-cols-2"
            role="radiogroup"
          >
            {(
              [
                [
                  "notify_salesperson",
                  t("config.notifySalesperson"),
                  t("config.actionNotifyHelper"),
                ],
                [
                  "prepare_follow_up",
                  t("config.prepareFollowUp"),
                  t("config.actionFollowUpHelper"),
                ],
              ] as const
            ).map(([value, label, helper]) => {
              const selected = config.action === value;
              return (
                <label
                  className={cn(
                    "cursor-pointer rounded-[12px] border px-3 py-3 text-left transition-colors",
                    selected
                      ? "border-[#044ce2] bg-[#f3f7ff]"
                      : "border-[#e1e7f1] bg-white hover:border-[#c9d9ff]",
                  )}
                  key={value}
                >
                  <input
                    checked={selected}
                    className="sr-only"
                    name="quote-action"
                    type="radio"
                    value={value}
                    onChange={() => onChange({ ...config, action: value })}
                  />
                  <span className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
                        selected
                          ? "border-[#044ce2] bg-[#044ce2]"
                          : "border-[#c5d0e0] bg-white",
                      )}
                    >
                      {selected ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-[#063586]">
                        {label}
                      </span>
                      <span className="mt-1 block text-[10px] leading-4 text-[#7d8aa0]">
                        {helper}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {config.action === "notify_salesperson" ? (
            <div className="space-y-2">
              <DerivedInfo
                helper={t("config.quoteOwnerHelper")}
                label={t("config.quoteOwner")}
                value={t("config.quoteOwnerValue")}
              />
              <p className="text-[11px] font-semibold text-[#24334c]">
                {t("config.channels")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <SoftCheckbox
                  checked={config.notifyInApp}
                  label={t("config.notifyInApp")}
                  onChange={(notifyInApp) =>
                    onChange({ ...config, notifyInApp })
                  }
                />
                <SoftCheckbox
                  checked={config.notifyEmail}
                  label={t("config.notifyEmailChannel")}
                  onChange={(notifyEmail) =>
                    onChange({ ...config, notifyEmail })
                  }
                />
              </div>
              <button
                className="action-motion soft-button h-9 w-full rounded-[9px] px-3 text-xs font-semibold text-[#044ce2]"
                type="button"
                onClick={() => setPreviewOpen(true)}
              >
                {t("preview.notification")}
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <SoftSelect
                label={`${t("config.template")} *`}
                options={[
                  {
                    value: "quote_follow_up_default",
                    label: t("config.quoteTemplate"),
                  },
                  {
                    value: "quote_follow_up_short",
                    label: t("config.quoteTemplateShort"),
                  },
                ]}
                value={config.templateId}
                onChange={(templateId) =>
                  onChange({
                    ...config,
                    templateId:
                      templateId === "quote_follow_up_short"
                        ? "quote_follow_up_short"
                        : "quote_follow_up_default",
                  })
                }
              />
              <SoftSelect
                label={`${t("config.language")} *`}
                options={[
                  { value: "customer", label: t("config.customerLanguage") },
                  { value: "en", label: "English" },
                  { value: "fr", label: "Français" },
                ]}
                value={config.languageMode}
                onChange={(languageMode) =>
                  onChange({
                    ...config,
                    languageMode:
                      languageMode === "en" || languageMode === "fr"
                        ? languageMode
                        : "customer",
                  })
                }
              />
              <button
                className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#044ce2] sm:col-span-2"
                type="button"
                onClick={() => setPreviewOpen(true)}
              >
                {t("preview.email")}
              </button>
            </div>
          )}
        </Section>
      </div>

      {previewOpen ? (
        <PreviewSheet
          body={
            config.action === "notify_salesperson"
              ? t("preview.quoteNotifyBody", { days: config.noResponseDays })
              : t("preview.quoteEmailBody")
          }
          open={previewOpen}
          subject={
            config.action === "notify_salesperson"
              ? t("preview.quoteNotifySubject")
              : t("preview.quoteEmailSubject")
          }
          title={
            config.action === "notify_salesperson"
              ? t("preview.notification")
              : t("preview.email")
          }
          to={
            config.action === "notify_salesperson"
              ? t("config.quoteOwnerValue")
              : t("config.billingContact")
          }
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
