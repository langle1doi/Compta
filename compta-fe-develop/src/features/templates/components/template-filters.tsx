"use client";

import { Funnel, LayoutGrid, List, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { SoftSelect } from "@/components/compte/soft-select";
import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

import type { TemplateFilters, TemplateViewMode } from "../model";

const DEFAULT_SORT: TemplateFilters["sort"] = "updated";

export function TemplateFiltersBar({
  filters,
  view,
  onFiltersChange,
  onViewChange,
  onClearFilters,
}: {
  filters: TemplateFilters;
  view: TemplateViewMode;
  onFiltersChange: (patch: Partial<TemplateFilters>) => void;
  onViewChange: (view: TemplateViewMode) => void;
  onClearFilters?: () => void;
}) {
  const t = useTranslations("templates.filters");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const activeCount = [
    filters.type !== "all",
    filters.useCase !== "all",
    filters.language !== "all",
    filters.status !== "all",
    filters.sort !== DEFAULT_SORT,
  ].filter(Boolean).length;

  useOutsideDismiss({
    active: open,
    onDismiss: () => setOpen(false),
    roots: [rootRef],
    allowSelector: "[data-soft-select-list]",
  });

  function clearFilters() {
    if (onClearFilters) {
      onClearFilters();
    } else {
      onFiltersChange({
        type: "all",
        useCase: "all",
        language: "all",
        status: "all",
        sort: DEFAULT_SORT,
      });
    }
    setOpen(false);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-[#e8eef7] px-3 py-3 sm:px-4">
      <label className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#98a4b5]"
        />
        <input
          className="compte-search-input soft-input h-9 w-full rounded-[9px] pr-3 pl-9 text-xs outline-none"
          placeholder={t("search")}
          type="search"
          value={filters.search}
          onChange={(event) => onFiltersChange({ search: event.target.value })}
        />
      </label>

      <div className="relative shrink-0" ref={rootRef}>
        <button
          aria-controls={panelId}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t("open")}
          className={cn(
            "action-motion soft-button relative grid h-9 w-9 place-items-center rounded-[9px] text-[#516078]",
            activeCount > 0 && "text-[#044ce2] ring-1 ring-[#044ce2]/25",
          )}
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <Funnel aria-hidden="true" className="h-4 w-4" strokeWidth={1.9} />
          {activeCount > 0 ? (
            <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#044ce2] px-1 text-[9px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </button>

        {open ? (
          <div
            aria-label={t("title")}
            className="absolute top-[calc(100%+6px)] right-0 z-30 w-[min(calc(100vw-2rem),18rem)] overflow-visible rounded-[12px] border border-white/80 bg-white/95 p-3 shadow-[8px_14px_32px_rgba(78,108,145,0.16)] backdrop-blur-sm"
            id={panelId}
            role="dialog"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-[#24334c]">{t("title")}</p>
              {activeCount > 0 ? (
                <button
                  className="inline-flex items-center gap-1 rounded-[7px] px-1.5 py-1 text-[10px] font-semibold text-[#516078] hover:bg-[#f5f8fd]"
                  type="button"
                  onClick={clearFilters}
                >
                  <X aria-hidden="true" className="h-3 w-3" />
                  {t("clear")}
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2.5">
              <SoftSelect
                label={t("type")}
                options={[
                  { value: "all", label: t("typeAll") },
                  { value: "document", label: t("document") },
                  { value: "email", label: t("email") },
                ]}
                value={filters.type}
                onChange={(value) =>
                  onFiltersChange({ type: value as TemplateFilters["type"] })
                }
              />
              <SoftSelect
                label={t("useCase")}
                options={[
                  { value: "all", label: t("useCaseAll") },
                  { value: "quote", label: t("quote") },
                  { value: "invoice", label: t("invoice") },
                  { value: "credit_note", label: t("creditNote") },
                  { value: "payment_reminder", label: t("paymentReminder") },
                  { value: "quote_follow_up", label: t("quoteFollowUp") },
                  { value: "quote_email", label: t("quoteEmail") },
                  { value: "invoice_email", label: t("invoiceEmail") },
                ]}
                value={filters.useCase}
                onChange={(value) =>
                  onFiltersChange({ useCase: value as TemplateFilters["useCase"] })
                }
              />
              <SoftSelect
                label={t("language")}
                options={[
                  { value: "all", label: t("languageAll") },
                  { value: "fr", label: "FR" },
                  { value: "en", label: "EN" },
                  { value: "vi", label: "VI" },
                ]}
                value={filters.language}
                onChange={(value) =>
                  onFiltersChange({ language: value as TemplateFilters["language"] })
                }
              />
              <SoftSelect
                label={t("status")}
                options={[
                  { value: "all", label: t("statusAll") },
                  { value: "active", label: t("active") },
                  { value: "inactive", label: t("inactive") },
                ]}
                value={filters.status}
                onChange={(value) =>
                  onFiltersChange({ status: value as TemplateFilters["status"] })
                }
              />
              <SoftSelect
                label={t("sort")}
                options={[
                  { value: "updated", label: t("sortUpdated") },
                  { value: "name", label: t("sortName") },
                  { value: "created", label: t("sortCreated") },
                ]}
                value={filters.sort}
                onChange={(value) =>
                  onFiltersChange({ sort: value as TemplateFilters["sort"] })
                }
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-[10px] border border-[#e1e7f1] bg-[#f7faff] p-0.5">
        {(
          [
            ["grid", LayoutGrid],
            ["list", List],
          ] as const
        ).map(([mode, Icon]) => (
          <button
            aria-pressed={view === mode}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors",
              view === mode
                ? "bg-white text-[#2458d6] shadow-sm"
                : "text-[#7d8aa0] hover:text-[#405069]",
            )}
            key={mode}
            type="button"
            onClick={() => onViewChange(mode)}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only">{t(`view.${mode}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
