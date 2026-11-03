"use client";

import { Filter, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ExportCsvButton } from "@/components/compte/export-csv-button";
import { SoftSelect } from "@/components/compte/soft-select";
import type { CustomerRecord, OwnerRecord } from "@/features/quotes/model";
import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

import type { InvoiceFilters, InvoiceListStatusFilter, InvoiceSortPreset } from "../model";
import { INVOICE_STATUS_FILTERS } from "../status";

export function InvoiceToolbar({
  query,
  status,
  sortPreset,
  filters,
  owners,
  customers,
  canCreate = false,
  onQueryChange,
  onStatusChange,
  onSortChange,
  onFiltersChange,
  onClearFilters,
  onCreate,
  onExport,
}: {
  query: string;
  status: InvoiceListStatusFilter;
  sortPreset: InvoiceSortPreset;
  filters: InvoiceFilters;
  owners: OwnerRecord[];
  customers: CustomerRecord[];
  canCreate?: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: InvoiceListStatusFilter) => void;
  onSortChange: (value: InvoiceSortPreset) => void;
  onFiltersChange: (patch: Partial<InvoiceFilters>) => void;
  onClearFilters: () => void;
  onCreate?: () => void;
  onExport?: () => void;
}) {
  const t = useTranslations("invoices");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRootRef = useRef<HTMLDivElement>(null);

  const statusActive = status !== "all";
  const advancedActive =
    statusActive ||
    Boolean(filters.ownerId) ||
    Boolean(filters.customerId) ||
    filters.datePreset !== "any";

  useOutsideDismiss({
    active: filtersOpen,
    onDismiss: () => setFiltersOpen(false),
    roots: [filtersRootRef],
    allowSelector: "[data-soft-select-list]",
  });

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#edf2f8] px-3.5 py-3">
      <label className="soft-input relative flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[9px] px-2.5 sm:max-w-[22rem]">
        <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#8a97ab]" />
        <input
          aria-label={t("search")}
          className="compte-search-input min-w-0 flex-1 bg-transparent text-xs text-[#24334c] outline-none placeholder:text-[#98a4b5]"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("search")}
          type="search"
          value={query}
        />
      </label>

      <div className="relative" ref={filtersRootRef}>
        <button
          aria-expanded={filtersOpen}
          className={cn(
            "action-motion soft-button inline-flex h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold text-[#405069]",
            advancedActive && "ring-1 ring-[#044ce2]/25",
          )}
          onClick={() => setFiltersOpen((open) => !open)}
          type="button"
        >
          <Filter aria-hidden="true" className="h-3.5 w-3.5" />
          {t("filters")}
          {statusActive ? (
            <span className="rounded-full bg-[#e7efff] px-1.5 py-0.5 text-[10px] font-semibold text-[#044ce2]">
              {t(`listStatus.${status}`)}
            </span>
          ) : null}
        </button>
        {filtersOpen ? (
          <div className="absolute top-[calc(100%+6px)] left-0 z-20 w-[min(calc(100vw-2rem),320px)] max-[480px]:w-[min(calc(100vw-6rem),320px)] rounded-[12px] border border-[#e1e7f1] bg-white p-3 shadow-[var(--shadow-surface)]">
            <div className="space-y-2.5">
              <SoftSelect
                label={t("statusLabel")}
                options={INVOICE_STATUS_FILTERS.map((option) => ({
                  value: option,
                  label: t(`listStatus.${option}`),
                }))}
                value={status}
                onChange={(value) => onStatusChange(value as InvoiceListStatusFilter)}
              />
              <SoftSelect
                label={t("owner")}
                options={[
                  { value: "", label: t("anyOwner") },
                  ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
                ]}
                value={filters.ownerId ?? ""}
                onChange={(value) => onFiltersChange({ ownerId: value || null })}
              />
              <SoftSelect
                label={t("customer")}
                options={[
                  { value: "", label: t("anyCustomer") },
                  ...customers.map((customer) => ({
                    value: customer.id,
                    label: customer.name,
                  })),
                ]}
                value={filters.customerId ?? ""}
                onChange={(value) => onFiltersChange({ customerId: value || null })}
              />
              <SoftSelect
                label={t("dates.any")}
                options={(["any", "month", "quarter", "overdue"] as const).map((preset) => ({
                  value: preset,
                  label: t(`dates.${preset}`),
                }))}
                value={filters.datePreset}
                onChange={(value) =>
                  onFiltersChange({ datePreset: value as InvoiceFilters["datePreset"] })
                }
              />
              {advancedActive ? (
                <div className="flex justify-end pt-1">
                  <button
                    className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-xs font-semibold text-[#516078]"
                    onClick={() => {
                      onClearFilters();
                      setFiltersOpen(false);
                    }}
                    type="button"
                  >
                    {t("clear")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <SoftSelect
        className="ml-auto w-auto min-w-[9.5rem] max-w-[14rem]"
        hideLabel
        label={t("sort.label")}
        options={[
          { value: "newest", label: t("sort.newest") },
          { value: "oldest", label: t("sort.oldest") },
          { value: "dueSoon", label: t("sort.dueSoon") },
          { value: "highest", label: t("sort.highest") },
          { value: "lowest", label: t("sort.lowest") },
        ]}
        triggerClassName="font-semibold text-[#405069]"
        value={sortPreset}
        onChange={(value) => onSortChange(value as InvoiceSortPreset)}
      />

      {onExport ? <ExportCsvButton label={t("export")} onClick={onExport} /> : null}

      {canCreate && onCreate ? (
        <button
          aria-label={t("newInvoice")}
          className="action-motion soft-primary inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold text-white sm:px-3"
          onClick={onCreate}
          type="button"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="hidden min-[400px]:inline">{t("newInvoice")}</span>
        </button>
      ) : null}
    </div>
  );
}
