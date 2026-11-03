"use client";

import { Building2, Copy, FileText, Star, X } from "lucide-react";
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
import { DocumentRenderer } from "../document-preview/DocumentRenderer";
import {
  sampleCompany,
  sampleDocumentFor,
} from "../document-preview/sample-document";
import { labelForUseCase, languageLabel } from "../labels";
import type {
  DocumentTemplateConfig,
  TemplateLanguage,
  TemplateRecord,
  TemplateStatus,
} from "../model";
import { defaultDocumentConfig } from "../model";
import { setTemplateStatus, updateTemplate } from "../store";

type PanelTab = "preview" | "details";
type EditSection =
  | "general"
  | "branding"
  | "header"
  | "lines"
  | "totals"
  | "terms"
  | "footer";

type DocDraft = {
  name: string;
  language: TemplateLanguage;
  status: TemplateStatus;
  isDefault: boolean;
  config: DocumentTemplateConfig;
};

function draftFromTemplate(template: TemplateRecord): DocDraft {
  return {
    name: template.name,
    language: template.language,
    status: template.status,
    isDefault: template.isDefault,
    config: {
      ...defaultDocumentConfig(),
      ...template.documentConfig,
    },
  };
}

function draftsEqual(a: DocDraft, b: DocDraft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const EDIT_SECTIONS: EditSection[] = [
  "general",
  "branding",
  "header",
  "lines",
  "totals",
  "terms",
  "footer",
];

export function DocumentTemplateWorkspace({
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
  const t = useTranslations("templates.documentWorkspace");
  const te = useTranslations("templates.editor");
  const locale = useLocale();
  const termsRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLTextAreaElement>(null);

  const [draft, setDraft] = useState(() => draftFromTemplate(template));
  const [baseline] = useState(() => draftFromTemplate(template));
  const [tab, setTab] = useState<PanelTab>("details");
  const [section, setSection] = useState<EditSection>("general");
  const [saving, setSaving] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  const dirty = useMemo(() => !draftsEqual(draft, baseline), [baseline, draft]);
  const live = editing ? draft : draftFromTemplate(template);
  const docType = template.useCase as "quote" | "invoice" | "credit_note";
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

  function patchDraft(patch: Partial<Omit<DocDraft, "config">>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function patchConfig(patch: Partial<DocumentTemplateConfig>) {
    setDraft((current) => ({
      ...current,
      config: { ...current.config, ...patch },
    }));
  }

  function saveEdit() {
    if (!dirty || saving) return;
    setSaving(true);
    updateTemplate(template.id, {
      name: draft.name.trim() || template.name,
      language: draft.language,
      status: draft.status,
      isDefault: draft.isDefault,
      documentConfig: draft.config,
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

  const config = live.config;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 shrink-0 bg-white/95 backdrop-blur-sm">
        <header className="border-b border-[#edf2f8] px-3.5 py-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5 pt-0.5">
              <IconTile
                icon={FileText}
                size="md"
                strokeWidth={2.1}
                tone="blue"
              />
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
            id="document-template-detail-tabs"
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
                        layoutId={`${TOP_TABS_ACTIVE_LAYOUT_ID}-document-template`}
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
        ) : (
          <AnimatedSelectionGroup
            className="min-w-0 border-b border-[#edf2f8] px-1.5"
            id="document-template-edit-sections"
          >
            <div
              aria-label={t("editSectionsLabel")}
              className="flex min-w-0 gap-0.5 overflow-x-auto py-1.5"
              role="tablist"
            >
              {EDIT_SECTIONS.map((item) => {
                const active = section === item;
                return (
                  <button
                    aria-selected={active}
                    className={cn(
                      "relative shrink-0 truncate rounded-full px-2.5 py-2 text-[11px] font-semibold transition-colors",
                      active
                        ? "text-[#2458d6]"
                        : "text-[#7d8aa0] hover:text-[#405069]",
                    )}
                    key={item}
                    role="tab"
                    type="button"
                    onClick={() => setSection(item)}
                  >
                    {active ? (
                      <AnimatedActiveIndicator
                        className="rounded-full"
                        layoutId="document-edit-section-pill"
                        variant="soft-pill"
                      />
                    ) : null}
                    <span className="relative z-[1] truncate">
                      {te(`sections.${item}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </AnimatedSelectionGroup>
        )}
      </div>

      <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {editing ? (
          <div
            className="space-y-4"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            {section === "general" ? (
              <Section title={t("sections.basic")}>
                <div className="space-y-3">
                  <Field label={te("fields.name")}>
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
                      {te("fields.company")}
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
                    label={te("fields.language")}
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
                  <div>
                    <span className="text-[11px] font-semibold text-[#66758d]">
                      {te("fields.documentType")}
                    </span>
                    <div className="mt-1 flex h-10 items-center rounded-[9px] border border-[#e8eef7] bg-[#f7faff] px-3 text-sm font-medium text-[#405069]">
                      {te(`docTypes.${docType}`)}
                    </div>
                  </div>
                  <SoftSelect
                    label={te("fields.status")}
                    options={[
                      { value: "active", label: t("active") },
                      { value: "inactive", label: t("inactive") },
                    ]}
                    value={draft.status}
                    onChange={(value) =>
                      patchDraft({ status: value as TemplateStatus })
                    }
                  />
                  <Toggle
                    checked={draft.isDefault}
                    helper={t("defaultHelper", {
                      useCase: labelForUseCase(template.useCase),
                      language: languageLabel(draft.language),
                      company: template.companyName,
                    })}
                    label={t("defaultSwitch")}
                    onChange={(value) => patchDraft({ isDefault: value })}
                  />
                </div>
              </Section>
            ) : null}

            {section === "branding" ? (
              <Section title={te("sections.branding")}>
                <div className="space-y-3">
                  <ColorField
                    label={te("fields.primaryColor")}
                    value={draft.config.primaryColor}
                    onChange={(value) => patchConfig({ primaryColor: value })}
                  />
                  <ColorField
                    label={te("fields.accentColor")}
                    value={draft.config.accentColor}
                    onChange={(value) => patchConfig({ accentColor: value })}
                  />
                  <ColorField
                    label={te("fields.textColor")}
                    value={draft.config.textColor}
                    onChange={(value) => patchConfig({ textColor: value })}
                  />
                  <p className="text-[11px] leading-4 text-[#7d8aa0]">
                    {te("brandingHint")}
                  </p>
                </div>
              </Section>
            ) : null}

            {section === "header" ? (
              <Section title={te("sections.header")}>
                <div className="space-y-2">
                  {(
                    [
                      "showLogo",
                      "showCompanyAddress",
                      "showSiret",
                      "showVatNumber",
                      "showCustomerBlock",
                    ] as const
                  ).map((key) => (
                    <Toggle
                      checked={draft.config[key]}
                      key={key}
                      label={te(`fields.${key}`)}
                      onChange={(value) => patchConfig({ [key]: value })}
                    />
                  ))}
                </div>
              </Section>
            ) : null}

            {section === "lines" ? (
              <Section title={te("sections.lines")}>
                <div className="space-y-2">
                  {(
                    [
                      "showDescription",
                      "showQuantity",
                      "showUnit",
                      "showUnitPrice",
                      "showDiscount",
                      "showVat",
                      "showAmount",
                    ] as const
                  ).map((key) => (
                    <Toggle
                      checked={draft.config[key]}
                      key={key}
                      label={te(`fields.${key}`)}
                      onChange={(value) => patchConfig({ [key]: value })}
                    />
                  ))}
                  <p className="text-[11px] leading-4 text-[#7d8aa0]">
                    {te("linesHint")}
                  </p>
                </div>
              </Section>
            ) : null}

            {section === "totals" ? (
              <Section title={te("sections.totals")}>
                <p className="text-[12px] leading-5 text-[#66758d]">
                  {te("totalsHint")}
                </p>
              </Section>
            ) : null}

            {section === "terms" ? (
              <Section title={te("sections.terms")}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#66758d]">
                      {te("fields.terms")}
                    </span>
                    <VariablePicker
                      onInsert={(token) =>
                        patchConfig({
                          terms: insertAtCursor(
                            draft.config.terms,
                            token,
                            termsRef.current,
                          ),
                        })
                      }
                    />
                  </div>
                  <textarea
                    ref={termsRef}
                    className="soft-input min-h-[140px] w-full rounded-[9px] px-3 py-2 text-sm leading-5"
                    value={draft.config.terms}
                    onChange={(event) =>
                      patchConfig({ terms: event.target.value })
                    }
                  />
                </div>
              </Section>
            ) : null}

            {section === "footer" ? (
              <Section title={te("sections.footer")}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#66758d]">
                      {te("fields.footer")}
                    </span>
                    <VariablePicker
                      onInsert={(token) =>
                        patchConfig({
                          footer: insertAtCursor(
                            draft.config.footer,
                            token,
                            footerRef.current,
                          ),
                        })
                      }
                    />
                  </div>
                  <textarea
                    ref={footerRef}
                    className="soft-input min-h-[90px] w-full rounded-[9px] px-3 py-2 text-sm leading-5"
                    value={draft.config.footer}
                    onChange={(event) =>
                      patchConfig({ footer: event.target.value })
                    }
                  />
                  <Toggle
                    checked={draft.config.showPageNumber}
                    label={te("fields.showPageNumber")}
                    onChange={(value) =>
                      patchConfig({ showPageNumber: value })
                    }
                  />
                </div>
              </Section>
            ) : null}
          </div>
        ) : null}

        {!editing && tab === "details" ? (
          <div
            className="space-y-4"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <Section layout="tiles" title={t("sections.basic")}>
              <Row label={t("fields.name")} value={template.name} />
              <Row label={t("fields.type")} value={t("documentType")} />
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

            <Section layout="tiles" title={t("sections.layout")}>
              <Row
                label={te("fields.primaryColor")}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full border border-[#e1e7f1]"
                      style={{ background: config.primaryColor }}
                    />
                    {config.primaryColor}
                  </span>
                }
              />
              <Row
                label={te("fields.accentColor")}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full border border-[#e1e7f1]"
                      style={{ background: config.accentColor }}
                    />
                    {config.accentColor}
                  </span>
                }
              />
              <Row
                label={te("fields.showLogo")}
                value={config.showLogo ? t("yes") : t("no")}
              />
              <Row
                label={te("fields.showCustomerBlock")}
                value={config.showCustomerBlock ? t("yes") : t("no")}
              />
              <Row
                label={te("fields.showPageNumber")}
                value={config.showPageNumber ? t("yes") : t("no")}
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

        {!editing && tab === "preview" ? (
          <div
            className="min-h-0"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <DocumentRenderer
              company={{ ...sampleCompany, name: template.companyName }}
              document={sampleDocumentFor(docType)}
              expandLabel={t("expandPreview")}
              mode="preview"
              template={{
                language: live.language,
                documentConfig: live.config,
              }}
              type={docType}
              onExpand={() => {
                setLightboxZoom(1);
                setLightboxOpen(true);
              }}
            />
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
        <DocumentRenderer
          company={{ ...sampleCompany, name: template.companyName }}
          document={sampleDocumentFor(docType)}
          mode="full"
          template={{
            language: live.language,
            documentConfig: live.config,
          }}
          type={docType}
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
  span = 1,
}: {
  label: string;
  value: ReactNode;
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
      <div className="mt-0.5 min-w-0 truncate text-[13px] font-semibold text-[#24334c]">
        {value}
      </div>
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        className="mt-1 h-10 w-full rounded-[9px] border border-[#e1e7f1] px-2"
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  helper,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  helper?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[10px] border border-[#e8eef7] px-3 py-2.5">
      <div className="min-w-0">
        <span className="text-[12px] font-medium text-[#405069]">{label}</span>
        {helper ? (
          <p className="text-[10px] leading-4 text-[#98a4b5]">{helper}</p>
        ) : null}
      </div>
      <input
        checked={checked}
        className="h-4 w-4 rounded border-[#c9d6ea]"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
