"use client";

import { Building2, Copy, Mail, Star, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState, type ReactNode } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
  TOP_TABS_ACTIVE_LAYOUT_ID,
} from "@/components/compte/animated-selection";
import { SoftSelect } from "@/components/compte/soft-select";
import { IconTile, StatusBadge } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";

import { TemplatePreviewLightbox } from "../components/template-preview-lightbox";
import { insertAtCursor, VariablePicker } from "../components/variable-picker";
import { EmailLivePreview } from "../email-preview/EmailLivePreview";
import { labelForUseCase, languageLabel } from "../labels";
import type {
  EmailTemplateConfig,
  TemplateLanguage,
  TemplateRecord,
  TemplateStatus,
} from "../model";
import { setTemplateStatus, updateTemplate } from "../store";
import { substituteVariables } from "../variables";
import { emailDemoValues, previewRecipient } from "./demo-values";

type PanelTab = "preview" | "details";

type EditDraft = {
  name: string;
  language: TemplateLanguage;
  status: TemplateStatus;
  isDefault: boolean;
  subject: string;
  body: string;
  signature: string;
};

function draftFromTemplate(template: TemplateRecord): EditDraft {
  const config = template.emailConfig!;
  return {
    name: template.name,
    language: template.language,
    status: template.status,
    isDefault: template.isDefault,
    subject: config.subject,
    body: config.body,
    signature: config.signature,
  };
}

function draftsEqual(a: EditDraft, b: EditDraft) {
  return (
    a.name === b.name &&
    a.language === b.language &&
    a.status === b.status &&
    a.isDefault === b.isDefault &&
    a.subject === b.subject &&
    a.body === b.body &&
    a.signature === b.signature
  );
}

export function EmailTemplateWorkspace({
  template,
  canManage,
  editing,
  onEditingChange,
  onClose,
  onDuplicate,
  onSetDefault,
  onSaved,
}: {
  template: TemplateRecord;
  canManage: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onClose?: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("templates.emailWorkspace");
  const locale = useLocale();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const signatureRef = useRef<HTMLTextAreaElement>(null);
  const [focusField, setFocusField] = useState<"subject" | "body" | "signature">(
    "body",
  );
  const [draft, setDraft] = useState(() => draftFromTemplate(template));
  const [baseline] = useState(() => draftFromTemplate(template));
  const [tab, setTab] = useState<PanelTab>("details");
  const [canvasMode, setCanvasMode] = useState<"template" | "preview">(
    "template",
  );
  const [saving, setSaving] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  const dirty = useMemo(() => !draftsEqual(draft, baseline), [baseline, draft]);
  const values = useMemo(
    () => emailDemoValues(template.useCase, template.companyName),
    [template.companyName, template.useCase],
  );
  const recipient = useMemo(
    () => previewRecipient(template.useCase, template.companyName),
    [template.companyName, template.useCase],
  );
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [locale],
  );

  const viewSource = editing ? draft : draftFromTemplate(template);
  const showResolved = !editing || canvasMode === "preview";
  const displaySubject = showResolved
    ? substituteVariables(viewSource.subject, values)
    : viewSource.subject;
  const displayBody = showResolved
    ? substituteVariables(viewSource.body, values)
    : viewSource.body;
  const displaySignature = showResolved
    ? substituteVariables(viewSource.signature, values)
    : viewSource.signature;

  function patchDraft(patch: Partial<EditDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function insertVariable(token: string) {
    if (focusField === "subject") {
      patchDraft({
        subject: insertAtCursor(draft.subject, token, subjectRef.current),
      });
      return;
    }
    if (focusField === "signature") {
      patchDraft({
        signature: insertAtCursor(
          draft.signature,
          token,
          signatureRef.current,
        ),
      });
      return;
    }
    patchDraft({
      body: insertAtCursor(draft.body, token, bodyRef.current),
    });
  }

  function saveEdit() {
    if (!dirty || saving) return;
    setSaving(true);
    const emailConfig: EmailTemplateConfig = {
      subject: draft.subject,
      body: draft.body,
      signature: draft.signature,
    };
    updateTemplate(template.id, {
      name: draft.name.trim() || template.name,
      language: draft.language,
      status: draft.status,
      isDefault: draft.isDefault,
      emailConfig,
    });
    setSaving(false);
    onEditingChange(false);
    onSaved?.();
  }

  function toggleStatus() {
    setTemplateStatus(
      template.id,
      template.status === "active" ? "inactive" : "active",
    );
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 shrink-0 bg-white/95 backdrop-blur-sm">
        <header className="border-b border-[#edf2f8] px-3.5 py-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5 pt-0.5">
              <IconTile icon={Mail} size="md" strokeWidth={2.1} tone="blue" />
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-[#063586]">
                  {editing ? draft.name : template.name}
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-[#7d8aa0]">
                  {labelForUseCase(template.useCase)} ·{" "}
                  {editing
                    ? draft.status === "active"
                      ? t("active")
                      : t("inactive")
                    : template.status === "active"
                      ? t("active")
                      : t("inactive")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {editing ? (
                <>
                  <button
                    className="action-motion soft-button inline-flex h-8 items-center rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
                    type="button"
                    onClick={() => onEditingChange(false)}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="action-motion soft-primary inline-flex h-8 items-center rounded-[8px] px-2.5 text-[11px] font-semibold text-white disabled:opacity-40"
                    disabled={!dirty || saving}
                    type="button"
                    onClick={saveEdit}
                  >
                    {saving ? t("saving") : t("save")}
                  </button>
                </>
              ) : null}
              {onClose ? (
                <button
                  aria-label={t("close")}
                  className="action-motion soft-button grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#66758d]"
                  type="button"
                  onClick={onClose}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {canManage && !editing ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#044ce2]"
                type="button"
                onClick={() => onEditingChange(true)}
              >
                {t("edit")}
              </button>
              <button
                className="action-motion soft-button inline-flex h-8 items-center gap-1 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
                type="button"
                onClick={onDuplicate}
              >
                <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                {t("duplicate")}
              </button>
              {!template.isDefault ? (
                <button
                  className="action-motion soft-button inline-flex h-8 items-center gap-1 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
                  type="button"
                  onClick={onSetDefault}
                >
                  <Star aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("setDefault")}
                </button>
              ) : null}
              <button
                className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
                type="button"
                onClick={toggleStatus}
              >
                {template.status === "active"
                  ? t("deactivate")
                  : t("activate")}
              </button>
            </div>
          ) : null}
        </header>

        {!editing ? (
          <AnimatedSelectionGroup
            className="min-w-0 border-b border-[#edf2f8] px-1.5"
            id="email-template-detail-tabs"
          >
            <div
              aria-label={t("tabsLabel")}
              className="flex min-w-0 gap-0.5 overflow-x-auto py-1.5"
              role="tablist"
            >
              {(["details", "preview"] as const).map((item) => {
                const active = tab === item;
                return (
                  <button
                    aria-selected={active}
                    className={cn(
                      "relative min-w-0 flex-1 truncate rounded-full px-1.5 py-2 text-[11px] font-semibold transition-colors",
                      active
                        ? "text-[#2458d6]"
                        : "text-[#7d8aa0] hover:text-[#405069]",
                    )}
                    key={item}
                    role="tab"
                    type="button"
                    onClick={() => setTab(item)}
                  >
                    {active ? (
                      <AnimatedActiveIndicator
                        className="rounded-full"
                        layoutId={`${TOP_TABS_ACTIVE_LAYOUT_ID}-email-template`}
                        variant="soft-pill"
                      />
                    ) : null}
                    <span className="relative z-[1] truncate">
                      {t(`tabs.${item}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </AnimatedSelectionGroup>
        ) : null}
      </div>

      <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {editing ? (
          <div
            className="space-y-4"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <Section title={t("sections.content")}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-[#7d8aa0]">{t("editHint")}</p>
                <AnimatedSelectionGroup id="email-edit-canvas-mode">
                  <div
                    aria-label={t("canvasModeLabel")}
                    className="flex gap-0.5 rounded-full bg-[#eef3fb] p-0.5"
                    role="tablist"
                  >
                    {(["template", "preview"] as const).map((mode) => {
                      const active = canvasMode === mode;
                      return (
                        <button
                          aria-selected={active}
                          className={cn(
                            "relative rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                            active
                              ? "text-[#2458d6]"
                              : "text-[#7d8aa0] hover:text-[#405069]",
                          )}
                          key={mode}
                          role="tab"
                          type="button"
                          onClick={() => setCanvasMode(mode)}
                        >
                          {active ? (
                            <AnimatedActiveIndicator
                              className="rounded-full"
                              layoutId="email-edit-mode-pill"
                              variant="soft-pill"
                            />
                          ) : null}
                          <span className="relative z-[1]">
                            {t(`canvasMode.${mode}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </AnimatedSelectionGroup>
              </div>

              {canvasMode === "preview" ? (
                <EmailLivePreview
                  body={displayBody}
                  expandLabel={t("expandPreview")}
                  from={recipient.from}
                  fromLabel={t("from")}
                  label={t("previewBanner")}
                  previewHint={t("previewRecipient")}
                  signature={displaySignature}
                  subject={displaySubject}
                  to={recipient.to}
                  toLabel={t("to")}
                  onExpand={() => {
                    setLightboxZoom(1);
                    setLightboxOpen(true);
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <Field label={t("subject")}>
                    <div className="mt-1 flex justify-end">
                      <VariablePicker
                        label={t("addVariable")}
                        onInsert={insertVariable}
                      />
                    </div>
                    <input
                      ref={subjectRef}
                      className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm"
                      value={draft.subject}
                      onChange={(event) =>
                        patchDraft({ subject: event.target.value })
                      }
                      onFocus={() => setFocusField("subject")}
                    />
                  </Field>
                  <Field label={t("body")}>
                    <div className="mt-1 flex items-center gap-2">
                      <VariablePicker
                        label={t("variable")}
                        onInsert={insertVariable}
                      />
                      <span className="text-[10px] text-[#98a4b5]">
                        {t("toolbarHint")}
                      </span>
                    </div>
                    <textarea
                      ref={bodyRef}
                      className="soft-input mt-1 min-h-[220px] w-full rounded-[9px] px-3 py-2 text-sm leading-6"
                      value={draft.body}
                      onChange={(event) =>
                        patchDraft({ body: event.target.value })
                      }
                      onFocus={() => setFocusField("body")}
                    />
                  </Field>
                  <Field label={t("signature")}>
                    <textarea
                      ref={signatureRef}
                      className="soft-input mt-1 min-h-[80px] w-full rounded-[9px] px-3 py-2 text-sm leading-5"
                      value={draft.signature}
                      onChange={(event) =>
                        patchDraft({ signature: event.target.value })
                      }
                      onFocus={() => setFocusField("signature")}
                    />
                  </Field>
                </div>
              )}
            </Section>

            <Section title={t("sections.settings")}>
              <div className="space-y-3">
                <Field label={t("fields.name")}>
                  <input
                    className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm"
                    value={draft.name}
                    onChange={(event) =>
                      patchDraft({ name: event.target.value })
                    }
                  />
                </Field>
                <div>
                  <span className="text-[11px] font-semibold text-[#66758d]">
                    {t("fields.company")}
                  </span>
                  <div className="mt-1 flex h-10 items-center gap-2 rounded-[9px] border border-[#e8eef7] bg-[#f7faff] px-3 text-sm font-medium text-[#405069]">
                    <Building2
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-[#7d8aa0]"
                    />
                    {template.companyName}
                  </div>
                </div>
                <SoftSelect
                  label={t("fields.language")}
                  options={[
                    { value: "fr", label: "FR" },
                    { value: "en", label: "EN" },
                    { value: "vi", label: "VI" },
                  ]}
                  value={draft.language}
                  onChange={(value) =>
                    patchDraft({ language: value as TemplateLanguage })
                  }
                />
                <SoftSelect
                  label={t("fields.status")}
                  options={[
                    { value: "active", label: t("active") },
                    { value: "inactive", label: t("inactive") },
                  ]}
                  value={draft.status}
                  onChange={(value) =>
                    patchDraft({ status: value as TemplateStatus })
                  }
                />
                <label className="flex items-center justify-between gap-3 rounded-[10px] border border-[#e8eef7] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[#405069]">
                      {t("defaultSwitch")}
                    </p>
                    <p className="text-[10px] leading-4 text-[#98a4b5]">
                      {t("defaultHelper", {
                        useCase: labelForUseCase(template.useCase),
                        language: languageLabel(draft.language),
                        company: template.companyName,
                      })}
                    </p>
                  </div>
                  <input
                    checked={draft.isDefault}
                    className="h-4 w-4 rounded border-[#c9d6ea]"
                    type="checkbox"
                    onChange={(event) =>
                      patchDraft({ isDefault: event.target.checked })
                    }
                  />
                </label>
              </div>
            </Section>
          </div>
        ) : null}

        {!editing && tab === "preview" ? (
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <EmailLivePreview
              body={displayBody}
              className="min-h-[min(640px,72vh)] flex-1"
              expandLabel={t("expandPreview")}
              from={recipient.from}
              fromLabel={t("from")}
              label={t("previewBanner")}
              previewHint={t("previewRecipient")}
              signature={displaySignature}
              subject={displaySubject}
              to={recipient.to}
              toLabel={t("to")}
              onExpand={() => {
                setLightboxZoom(1);
                setLightboxOpen(true);
              }}
            />
          </div>
        ) : null}

        {!editing && tab === "details" ? (
          <div
            className="space-y-4"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <Section layout="tiles" title={t("sections.basic")}>
              <Row label={t("fields.name")} value={template.name} />
              <Row label={t("fields.type")} value={t("emailType")} />
              <Row
                label={t("fields.useCase")}
                value={labelForUseCase(template.useCase)}
              />
              <Row
                label={t("fields.language")}
                value={languageLabel(template.language)}
              />
              <Row label={t("fields.company")} value={template.companyName} />
              <Row
                label={t("fields.status")}
                value={
                  <StatusBadge
                    size="xs"
                    tone={template.status === "active" ? "green" : "slate"}
                  >
                    {template.status === "active" ? t("active") : t("inactive")}
                  </StatusBadge>
                }
              />
              <Row
                label={t("fields.default")}
                value={
                  template.isDefault ? (
                    <StatusBadge size="xs" tone="blue">
                      {t("default")}
                    </StatusBadge>
                  ) : (
                    t("no")
                  )
                }
              />
            </Section>
            <Section layout="tiles" title={t("sections.contentSummary")}>
              <Row label={t("subject")} span={2} value={displaySubject} />
              <Row
                label={t("body")}
                multiline
                span={2}
                value={
                  displayBody.length > 280
                    ? `${displayBody.slice(0, 280)}…`
                    : displayBody
                }
              />
              <Row
                label={t("signature")}
                multiline
                span={2}
                value={displaySignature || "—"}
              />
            </Section>
            <Section layout="tiles" title={t("sections.timestamps")}>
              <Row label={t("fields.createdBy")} value={template.createdBy} />
              <Row
                label={t("fields.createdAt")}
                value={dateTime.format(new Date(template.createdAt))}
              />
              <Row
                label={t("fields.updatedAt")}
                value={dateTime.format(new Date(template.updatedAt))}
              />
            </Section>
          </div>
        ) : null}
      </div>

      <TemplatePreviewLightbox
        closeLabel={t("closeLightbox")}
        open={lightboxOpen}
        title={template.name}
        zoom={lightboxZoom}
        zoomInLabel={t("zoomIn")}
        zoomOutLabel={t("zoomOut")}
        onClose={() => setLightboxOpen(false)}
        onZoomChange={setLightboxZoom}
      >
        <EmailLivePreview
          bare
          body={displayBody}
          from={recipient.from}
          fromLabel={t("from")}
          previewHint={t("previewRecipient")}
          signature={displaySignature}
          subject={displaySubject}
          to={recipient.to}
          toLabel={t("to")}
        />
      </TemplatePreviewLightbox>
    </section>
  );
}

function Section({
  title,
  children,
  layout = "stack",
}: {
  title: string;
  children: ReactNode;
  layout?: "stack" | "tiles";
}) {
  return (
    <section className="rounded-[12px] border border-[#edf2f8] bg-[rgb(255_255_255/0.78)] px-3 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.85)] backdrop-blur-[12px]">
      <h3 className="text-[12px] font-semibold text-[#24334c]">{title}</h3>
      <div
        className={cn(
          "mt-3",
          layout === "tiles"
            ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
            : "space-y-3",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  hint,
  multiline = false,
  span = 1,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  multiline?: boolean;
  span?: 1 | 2;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[10px] border border-[#edf2f8] bg-[#f8fafc]/90 px-2.5 py-2",
        span === 2 && "sm:col-span-2",
      )}
    >
      <p className="text-[10px] font-semibold text-[#98a4b5]">{label}</p>
      <div
        className={cn(
          "mt-0.5 min-w-0 text-[13px] font-semibold text-[#24334c]",
          multiline
            ? "whitespace-pre-wrap text-xs font-medium leading-5"
            : "truncate",
        )}
      >
        {value}
      </div>
      {hint ? (
        <p className="mt-1 text-[10px] leading-4 text-[#98a4b5]">{hint}</p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[#66758d]">{label}</span>
      {children}
    </label>
  );
}
