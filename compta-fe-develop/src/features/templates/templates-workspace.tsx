"use client";

import { FileStack, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";
import { SoftSelect } from "@/components/compte/soft-select";
import { SoftToast } from "@/components/compte/soft-toast";
import { FormSheet } from "@/components/forms/form-sheet";
import { can } from "@/features/settings/can";
import { useCurrentCompany } from "@/features/settings/company-store";
import { usePermissions } from "@/features/settings/session-provider";
import { cn } from "@/lib/utils";

import { NewTemplateSheet } from "./components/new-template-sheet";
import { TemplateCard } from "./components/template-card";
import type { TemplateMenuAction } from "./components/template-card-menu";
import { TemplateFiltersBar } from "./components/template-filters";
import { TemplatePreviewPanel } from "./components/template-preview-panel";
import { TemplatesKpisStrip } from "./components/templates-kpis";
import {
  formatUpdatedAt,
  labelForUseCase,
  languageLabel,
} from "./labels";
import type {
  TemplateFilters,
  TemplateRecord,
  TemplateViewMode,
} from "./model";
import {
  deleteTemplate,
  duplicateTemplate,
  setTemplateDefault,
  setTemplateStatus,
  useTemplatesState,
} from "./store";
import { filterTemplates, templatesKpis } from "./utils";

type TopTab = "all" | "documents" | "emails";

const emptyFilters: TemplateFilters = {
  search: "",
  type: "all",
  useCase: "all",
  language: "all",
  status: "all",
  sort: "updated",
};

export function TemplatesWorkspace() {
  const t = useTranslations("templates");
  const locale = useLocale();
  const { companyId } = useCurrentCompany();
  const { templates: allTemplates } = useTemplatesState();

  const activePermissions = usePermissions();
  const canReadDocuments = can(activePermissions, "template.pdf.read");
  const canReadEmails = can(activePermissions, "template.email.read");
  const canManageDocuments = can(activePermissions, "template.pdf.manage");
  const canManageEmails = can(activePermissions, "template.email.manage");
  const canRead = canReadDocuments || canReadEmails;
  const canManage = canManageDocuments || canManageEmails;

  const [requestedTab, setTopTab] = useState<TopTab>("all");
  const topTab =
    (requestedTab === "documents" && !canReadDocuments) ||
    (requestedTab === "emails" && !canReadEmails)
      ? "all"
      : requestedTab;
  const [filters, setFilters] = useState<TemplateFilters>(emptyFilters);
  const [view, setView] = useState<TemplateViewMode>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailEditing, setDetailEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [notice, setNotice] = useState("");

  const scoped = useMemo(
    () =>
      allTemplates.filter(
        (item) =>
          item.companyId === companyId &&
          (item.type === "document" ? canReadDocuments : canReadEmails),
      ),
    [allTemplates, canReadDocuments, canReadEmails, companyId],
  );

  const tabScoped = useMemo(() => {
    if (topTab === "documents") {
      return scoped.filter((item) => item.type === "document");
    }
    if (topTab === "emails") {
      return scoped.filter((item) => item.type === "email");
    }
    return scoped;
  }, [scoped, topTab]);

  const filtered = useMemo(
    () => filterTemplates(tabScoped, filters),
    [filters, tabScoped],
  );

  const kpis = useMemo(() => templatesKpis(scoped), [scoped]);

  const counts = useMemo(
    () => ({
      all: scoped.length,
      documents: scoped.filter((item) => item.type === "document").length,
      emails: scoped.filter((item) => item.type === "email").length,
    }),
    [scoped],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    scoped.find((item) => item.id === selectedId) ??
    null;

  const deleteTarget = scoped.find((item) => item.id === deleteId) ?? null;
  const replacementOptions = useMemo(() => {
    if (!deleteTarget) return [];
    return scoped
      .filter(
        (item) =>
          item.id !== deleteTarget.id &&
          item.useCase === deleteTarget.useCase &&
          item.language === deleteTarget.language &&
          item.type === deleteTarget.type &&
          item.status === "active",
      )
      .map((item) => ({ value: item.id, label: item.name }));
  }, [deleteTarget, scoped]);

  function canManageTemplate(template: TemplateRecord) {
    return template.type === "document" ? canManageDocuments : canManageEmails;
  }

  function closeDetail() {
    setSelectedId(null);
    setDetailEditing(false);
  }

  function selectTemplate(id: string, options?: { edit?: boolean }) {
    const switching = selectedId !== id;
    setSelectedId(id);
    if (options?.edit) {
      setDetailEditing(true);
    } else if (switching) {
      setDetailEditing(false);
    }
  }

  function handleMenuAction(template: TemplateRecord, action: TemplateMenuAction) {
    if (action === "preview") {
      selectTemplate(template.id);
      return;
    }
    if (action === "edit") {
      selectTemplate(template.id, { edit: true });
      return;
    }
    if (action === "duplicate") {
      const copy = duplicateTemplate(template.id);
      if (copy) {
        setSelectedId(copy.id);
        setNotice(t("toast.duplicated"));
      }
      return;
    }
    if (action === "set_default") {
      setTemplateDefault(template.id);
      setNotice(t("toast.defaultSet"));
      return;
    }
    if (action === "toggle_status") {
      setTemplateStatus(
        template.id,
        template.status === "active" ? "inactive" : "active",
      );
      setNotice(
        template.status === "active"
          ? t("toast.deactivated")
          : t("toast.activated"),
      );
      return;
    }
    if (action === "delete") {
      setDeleteId(template.id);
      setReplacementId("");
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const result = deleteTemplate(
      deleteTarget.id,
      deleteTarget.isDefault ? replacementId || undefined : undefined,
    );
    if (!result.ok) {
      setNotice(t("toast.needsReplacement"));
      return;
    }
    if (selectedId === deleteTarget.id) setSelectedId(null);
    setDeleteId(null);
    setNotice(t("toast.deleted"));
  }

  if (!canRead) {
    return (
      <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-6">
        <p className="text-sm text-[#7d8aa0]">{t("forbidden")}</p>
      </main>
    );
  }

  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="dashboard-scroll dashboard-page dashboard-stack flex min-h-0 min-w-0 flex-1 flex-col gap-[var(--dashboard-gap)] overflow-x-hidden overflow-y-auto pb-6 lg:overflow-hidden lg:pb-3">
        <header className="dashboard-enter enter-0 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-xl text-[12px] leading-4 text-[#7d8aa0]">
            {t("subtitle")}
          </p>
          {canManage ? (
            <button
              className="action-motion soft-primary inline-flex h-9 items-center gap-1.5 self-start rounded-[9px] px-3 text-xs font-semibold text-white sm:self-auto"
              type="button"
              onClick={() => setCreateOpen(true)}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              {t("new")}
            </button>
          ) : null}
        </header>

        <div className="dashboard-enter enter-1 shrink-0">
          <TemplatesKpisStrip kpis={kpis} />
        </div>

        <AnimatedSelectionGroup
          className="dashboard-enter enter-2 shrink-0"
          id="templates-top-tabs"
        >
          <div
            aria-label={t("tabsLabel")}
            className="flex min-w-0 gap-1 overflow-x-auto"
            role="tablist"
          >
            {(
              [
                ["all", counts.all],
                ["documents", counts.documents],
                ["emails", counts.emails],
              ] as const
            )
              .filter(
                ([tab]) =>
                  tab === "all" || (tab === "documents" ? canReadDocuments : canReadEmails),
              )
              .map(([tab, count]) => {
              const active = topTab === tab;
              return (
                <button
                  aria-selected={active}
                  className={cn(
                    "relative shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors",
                    active
                      ? "text-[#2458d6]"
                      : "text-[#7d8aa0] hover:text-[#405069]",
                  )}
                  key={tab}
                  role="tab"
                  type="button"
                  onClick={() => setTopTab(tab)}
                >
                  {active ? (
                    <AnimatedActiveIndicator
                      className="rounded-full"
                      layoutId="templates-top-tab"
                      variant="soft-pill"
                    />
                  ) : null}
                  <span className="relative z-[1]">
                    {t(`tabs.${tab}`)} {count}
                  </span>
                </button>
              );
            })}
          </div>
        </AnimatedSelectionGroup>

        <section className="dashboard-card dashboard-enter enter-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TemplateFiltersBar
            filters={filters}
            view={view}
            onClearFilters={() =>
              setFilters((current) => ({
                ...emptyFilters,
                search: current.search,
              }))
            }
            onFiltersChange={(patch) =>
              setFilters((current) => ({ ...current, ...patch }))
            }
            onViewChange={setView}
          />

          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <FileStack aria-hidden="true" className="h-8 w-8 text-[#b7c3d6]" />
              <p className="text-sm font-semibold text-[#24334c]">
                {scoped.length === 0 ? t("empty.title") : t("empty.filteredTitle")}
              </p>
              <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">
                {scoped.length === 0 ? t("empty.body") : t("empty.filteredBody")}
              </p>
              {scoped.length === 0 && canManage ? (
                <button
                  className="action-motion soft-primary mt-2 inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-xs font-semibold text-white"
                  type="button"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("new")}
                </button>
              ) : null}
            </div>
          ) : view === "grid" ? (
            <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filtered.map((template) => (
                  <TemplateCard
                    canManage={canManageTemplate(template)}
                    key={template.id}
                    selected={selectedId === template.id}
                    template={template}
                    onAction={(action) => handleMenuAction(template, action)}
                    onSelect={() => selectTemplate(template.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="app-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto">
              <table className="min-w-[720px] w-full border-collapse text-left">
                <thead className="sticky top-0 z-[1] bg-[#f7faff]">
                  <tr className="border-b border-[#e8eef7] text-[10px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
                    <th className="px-4 py-2.5">{t("list.name")}</th>
                    <th className="px-3 py-2.5">{t("list.useCase")}</th>
                    <th className="px-3 py-2.5">{t("list.language")}</th>
                    <th className="px-3 py-2.5">{t("list.status")}</th>
                    <th className="px-3 py-2.5">{t("list.updated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((template) => (
                    <tr
                      className={cn(
                        "cursor-pointer border-b border-[#edf1f7] text-[12px] transition-colors hover:bg-[#f8fbff]",
                        selectedId === template.id && "bg-[#f3f4f6]",
                      )}
                      key={template.id}
                      onClick={() => selectTemplate(template.id)}
                    >
                      <td className="px-4 py-3 font-semibold text-[#24334c]">
                        {template.name}
                        {template.isDefault ? (
                          <span className="ml-2 text-[10px] font-semibold text-[#2458d6]">
                            {t("badges.default")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[#66758d]">
                        {labelForUseCase(template.useCase)}
                      </td>
                      <td className="px-3 py-3 text-[#66758d]">
                        {languageLabel(template.language)}
                      </td>
                      <td className="px-3 py-3 text-[#66758d]">
                        {template.status === "active"
                          ? t("status.active")
                          : t("status.inactive")}
                      </td>
                      <td className="px-3 py-3 text-[#98a4b5]">
                        {formatUpdatedAt(template.updatedAt, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <FormSheet
        closeLabel={t("preview.close")}
        contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
        open={selected !== null}
        showHeader={false}
        title={selected?.name ?? t("title")}
        widthClassName="sm:max-w-[520px]"
        zIndexClassName="z-[60]"
        onClose={closeDetail}
      >
        {selected ? (
          <TemplatePreviewPanel
            canManage={canManageTemplate(selected)}
            editing={detailEditing}
            key={`${selected.id}-${detailEditing ? "edit" : "view"}-${selected.updatedAt}`}
            template={selected}
            onClose={closeDetail}
            onDuplicate={() => handleMenuAction(selected, "duplicate")}
            onEditingChange={setDetailEditing}
            onSaved={() => setNotice(t("toast.updated"))}
            onSetDefault={() => handleMenuAction(selected, "set_default")}
          />
        ) : null}
      </FormSheet>

      <NewTemplateSheet
        canCreateDocument={canManageDocuments}
        canCreateEmail={canManageEmails}
        open={createOpen && canManage}
        onClose={() => setCreateOpen(false)}
        onCreated={({ id }) => {
          setCreateOpen(false);
          setSelectedId(id);
          setDetailEditing(true);
          setNotice(t("toast.created"));
        }}
      />

      <FormSheet
        footer={
          <div className="flex justify-end gap-2">
            <button
              className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
              type="button"
              onClick={() => setDeleteId(null)}
            >
              {t("delete.cancel")}
            </button>
            <button
              className="action-motion soft-primary h-9 rounded-[9px] bg-[#c9564f] px-3 text-xs font-semibold text-white"
              disabled={Boolean(deleteTarget?.isDefault) && !replacementId}
              type="button"
              onClick={confirmDelete}
            >
              {t("delete.confirm")}
            </button>
          </div>
        }
        open={Boolean(deleteId)}
        title={t("delete.title")}
        onClose={() => setDeleteId(null)}
      >
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <p className="text-[13px] leading-5 text-[#405069]">
            {deleteTarget?.isDefault
              ? t("delete.defaultBody", { name: deleteTarget.name })
              : t("delete.body", { name: deleteTarget?.name ?? "" })}
          </p>
          {deleteTarget?.isDefault ? (
            <SoftSelect
              label={t("delete.replacement")}
              options={[
                { value: "", label: t("delete.chooseReplacement") },
                ...replacementOptions,
              ]}
              value={replacementId}
              onChange={setReplacementId}
            />
          ) : null}
        </div>
      </FormSheet>

      <SoftToast message={notice} onDismiss={() => setNotice("")} />
    </main>
  );
}
