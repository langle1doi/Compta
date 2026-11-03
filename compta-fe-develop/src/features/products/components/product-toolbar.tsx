"use client";

import { Filter, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ExportCsvButton } from "@/components/compte/export-csv-button";
import { SoftSelect } from "@/components/compte/soft-select";
import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

import {
  PRODUCT_CATEGORIES,
  type ProductFilters,
  type ProductSortPreset,
} from "../model";

export function ProductToolbar({
  filters,
  sortPreset,
  canCreate,
  onFiltersChange,
  onSortChange,
  onClearFilters,
  onCreate,
  onExport,
}: {
  filters: ProductFilters;
  sortPreset: ProductSortPreset;
  canCreate: boolean;
  onFiltersChange: (patch: Partial<ProductFilters>) => void;
  onSortChange: (value: ProductSortPreset) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onExport?: () => void;
}) {
  const t = useTranslations("products");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRootRef = useRef<HTMLDivElement>(null);

  const typeActive = filters.type !== "all";
  const statusActive = filters.status !== "all";
  const categoryActive = filters.categoryId !== "all";
  const advancedActive = typeActive || statusActive || categoryActive;

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
          placeholder={t("search")}
          type="search"
          value={filters.query}
          onChange={(event) => onFiltersChange({ query: event.target.value })}
        />
      </label>

      <div className="relative" ref={filtersRootRef}>
        <button
          aria-expanded={filtersOpen}
          className={cn(
            "action-motion soft-button inline-flex h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold text-[#405069]",
            advancedActive && "ring-1 ring-[#044ce2]/25",
          )}
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <Filter aria-hidden="true" className="h-3.5 w-3.5" />
          {t("moreFilters")}
          {typeActive ? (
            <span className="rounded-full bg-[#e7efff] px-1.5 py-0.5 text-[10px] font-semibold text-[#044ce2]">
              {t(`type.${filters.type}`)}
            </span>
          ) : null}
          {statusActive ? (
            <span className="rounded-full bg-[#e7efff] px-1.5 py-0.5 text-[10px] font-semibold text-[#044ce2]">
              {t(`status.${filters.status}`)}
            </span>
          ) : null}
        </button>
        {filtersOpen ? (
          <div className="absolute top-[calc(100%+6px)] left-0 z-20 w-[min(calc(100vw-2rem),320px)] max-[480px]:w-[min(calc(100vw-6rem),320px)] rounded-[12px] border border-[#e1e7f1] bg-white p-3 shadow-[var(--shadow-surface)]">
            <div className="space-y-2.5">
              <SoftSelect
                label={t("filters.type")}
                options={[
                  { value: "all", label: t("filters.typeAll") },
                  { value: "good", label: t("type.good") },
                  { value: "service", label: t("type.service") },
                ]}
                value={filters.type}
                onChange={(value) =>
                  onFiltersChange({
                    type: value as ProductFilters["type"],
                    tab: "all",
                  })
                }
              />
              <SoftSelect
                label={t("filters.status")}
                options={[
                  { value: "all", label: t("filters.statusAll") },
                  { value: "active", label: t("status.active") },
                  { value: "inactive", label: t("status.inactive") },
                ]}
                value={filters.status}
                onChange={(value) =>
                  onFiltersChange({
                    status: value as ProductFilters["status"],
                    tab: "all",
                  })
                }
              />
              <SoftSelect
                label={t("filters.category")}
                options={[
                  { value: "all", label: t("filters.categoryAll") },
                  ...PRODUCT_CATEGORIES.map((id) => ({
                    value: id,
                    label: t(`categories.${id}`),
                  })),
                ]}
                value={filters.categoryId}
                onChange={(value) =>
                  onFiltersChange({
                    categoryId: value as ProductFilters["categoryId"],
                    tab: "all",
                  })
                }
              />
              {advancedActive ? (
                <div className="flex justify-end pt-1">
                  <button
                    className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-xs font-semibold text-[#516078]"
                    type="button"
                    onClick={() => {
                      onClearFilters();
                      setFiltersOpen(false);
                    }}
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
          { value: "nameAsc", label: t("sort.nameAsc") },
          { value: "nameDesc", label: t("sort.nameDesc") },
          { value: "newest", label: t("sort.newest") },
          { value: "priceHigh", label: t("sort.priceHigh") },
          { value: "priceLow", label: t("sort.priceLow") },
          { value: "mostUsed", label: t("sort.mostUsed") },
        ]}
        triggerClassName="font-semibold text-[#405069]"
        value={sortPreset}
        onChange={(value) => onSortChange(value as ProductSortPreset)}
      />

      {onExport ? <ExportCsvButton label={t("export")} onClick={onExport} /> : null}

      {canCreate ? (
        <button
          aria-label={t("addAction")}
          className="action-motion soft-primary inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold text-white sm:px-3"
          type="button"
          onClick={onCreate}
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="hidden min-[400px]:inline">{t("addAction")}</span>
        </button>
      ) : null}
    </div>
  );
}
