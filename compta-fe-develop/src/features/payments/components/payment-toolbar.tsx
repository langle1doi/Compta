"use client";

import { Filter, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ExportCsvButton } from "@/components/compte/export-csv-button";
import { SoftSelect } from "@/components/compte/soft-select";
import type { InvoicePaymentMethod } from "@/features/invoices/model";
import type { CustomerRecord } from "@/features/quotes/model";
import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

import {
  PAYMENT_STATUS_FILTERS,
  type PaymentFilters,
  type PaymentListStatus,
} from "../model";

export function PaymentToolbar({
  query,
  status,
  method,
  filters,
  customers,
  methods,
  invoices,
  canCreate = false,
  onQueryChange,
  onStatusChange,
  onMethodChange,
  onFiltersChange,
  onClearFilters,
  onCreate,
  onExport,
}: {
  query: string;
  status: PaymentListStatus | "all";
  method: InvoicePaymentMethod | "all";
  filters: PaymentFilters;
  customers: CustomerRecord[];
  methods: InvoicePaymentMethod[];
  invoices: Array<{ id: string; label: string }>;
  canCreate?: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: PaymentListStatus | "all") => void;
  onMethodChange: (value: InvoicePaymentMethod | "all") => void;
  onFiltersChange: (patch: Partial<PaymentFilters>) => void;
  onClearFilters: () => void;
  onCreate?: () => void;
  onExport?: () => void;
}) {
  const t = useTranslations("payments");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRootRef = useRef<HTMLDivElement>(null);

  const statusActive = status !== "all";
  const methodActive = method !== "all";
  const advancedActive =
    statusActive ||
    methodActive ||
    Boolean(filters.customerId) ||
    Boolean(filters.invoiceId) ||
    filters.datePreset !== "any" ||
    filters.reconciliation !== "all";

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
        </button>
        {filtersOpen ? (
          <div className="absolute top-[calc(100%+6px)] left-0 z-20 w-[min(calc(100vw-2rem),320px)] max-[480px]:w-[min(calc(100vw-6rem),320px)] rounded-[12px] border border-[#e1e7f1] bg-white p-3 shadow-[var(--shadow-surface)]">
            <div className="space-y-2.5">
              <SoftSelect
                label={t("statusLabel")}
                options={PAYMENT_STATUS_FILTERS.map((option) => ({
                  value: option,
                  label: t(`listStatus.${option}`),
                }))}
                value={status}
                onChange={(value) => onStatusChange(value as PaymentListStatus | "all")}
              />
              <SoftSelect
                label={t("methodLabel")}
                options={[
                  { value: "all", label: t("methods.all") },
                  ...methods.map((item) => ({
                    value: item,
                    label: t(`methods.${item}`),
                  })),
                ]}
                value={method}
                onChange={(value) => onMethodChange(value as InvoicePaymentMethod | "all")}
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
                label={t("invoice")}
                options={[
                  { value: "", label: t("anyInvoice") },
                  ...invoices.map((invoice) => ({
                    value: invoice.id,
                    label: invoice.label,
                  })),
                ]}
                value={filters.invoiceId ?? ""}
                onChange={(value) => onFiltersChange({ invoiceId: value || null })}
              />
              <SoftSelect
                label={t("dates.any")}
                options={(["any", "month", "quarter"] as const).map((preset) => ({
                  value: preset,
                  label: t(`dates.${preset}`),
                }))}
                value={filters.datePreset}
                onChange={(value) =>
                  onFiltersChange({ datePreset: value as PaymentFilters["datePreset"] })
                }
              />
              <SoftSelect
                label={t("reconciliationLabel")}
                options={[
                  { value: "all", label: t("reconciliation.all") },
                  { value: "matched", label: t("reconciliation.matched") },
                  { value: "to_match", label: t("reconciliation.to_match") },
                ]}
                value={filters.reconciliation}
                onChange={(value) =>
                  onFiltersChange({
                    reconciliation: value as PaymentFilters["reconciliation"],
                  })
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

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {onExport ? <ExportCsvButton label={t("export")} onClick={onExport} /> : null}

        {canCreate && onCreate ? (
          <button
            aria-label={t("recordAction")}
            className="action-motion soft-primary inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold text-white sm:px-3"
            onClick={onCreate}
            type="button"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden min-[400px]:inline">{t("recordAction")}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
