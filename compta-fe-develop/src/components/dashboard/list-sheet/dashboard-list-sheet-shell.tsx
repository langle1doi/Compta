"use client";

import type { ReactNode } from "react";

import { PageSizeSelect } from "@/components/compte/page-size-select";
import { SoftSelect } from "@/components/compte/soft-select";
import { FormSheet } from "@/components/forms/form-sheet";

import { LIST_SHEET_PAGE_SIZES } from "./use-paged-list-sheet";

export const listSheetCell = "min-w-0 overflow-hidden";

type PaginationCopy = {
  summary: (values: { from: number; to: number; total: number }) => string;
  rowsPerPage: (count: number) => string;
  pageSize: string;
  prev: string;
  next: string;
};

type FilterOption = { value: string; label: string };

/** Shared i18n wiring for list-sheet pagination footers. */
export function listSheetPaginationCopy(
  t: (key: string, values?: Record<string, number>) => string,
): PaginationCopy {
  return {
    summary: (values) => t("pagination.summary", values),
    rowsPerPage: (count) => t("pagination.rowsPerPage", { count }),
    pageSize: t("pagination.pageSize"),
    prev: t("pagination.prev"),
    next: t("pagination.next"),
  };
}

export function DashboardListSheetShell({
  open,
  onClose,
  title,
  subtitle,
  closeLabel,
  searchLabel,
  searchPlaceholder,
  query,
  onQueryChange,
  filterLabel,
  filterValue,
  filterOptions,
  onFilterChange,
  filtersActive,
  onClearFilters,
  clearFiltersLabel,
  emptyTitle,
  emptyBody,
  totalCount,
  pageCount,
  safePage,
  rangeFrom,
  rangeTo,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pagination,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  closeLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  filterLabel: string;
  filterValue: string;
  filterOptions: FilterOption[];
  onFilterChange: (value: string) => void;
  filtersActive: boolean;
  onClearFilters: () => void;
  clearFiltersLabel: string;
  emptyTitle: string;
  emptyBody: string;
  totalCount: number;
  pageCount: number;
  safePage: number;
  rangeFrom: number;
  rangeTo: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pagination: PaginationCopy;
  children: ReactNode;
}) {
  return (
    <FormSheet
      closeLabel={closeLabel}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      description={subtitle}
      fillBesideSidebar
      open={open}
      title={title}
      zIndexClassName="z-[65]"
      onClose={onClose}
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-[#edf2f8] px-3.5 py-3 sm:px-5">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{searchLabel}</span>
            <input
              className="compte-search-input soft-input h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c] outline-none"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              type="search"
              value={query}
            />
          </label>
          <SoftSelect
            hideLabel
            className="w-full sm:w-[180px]"
            label={filterLabel}
            options={filterOptions}
            triggerClassName="h-10"
            value={filterValue}
            onChange={onFilterChange}
          />
          {filtersActive ? (
            <button
              className="action-motion soft-button h-10 shrink-0 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
              type="button"
              onClick={onClearFilters}
            >
              {clearFiltersLabel}
            </button>
          ) : null}
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-[#24334c]">{emptyTitle}</p>
          <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">{emptyBody}</p>
        </div>
      ) : (
        children
      )}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#edf2f8] px-3.5 py-2 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-[11px] text-[#7d8aa0]">
            {pagination.summary({ from: rangeFrom, to: rangeTo, total: totalCount })}
          </p>
          <PageSizeSelect
            formatOption={(count) => pagination.rowsPerPage(count)}
            label={pagination.pageSize}
            options={LIST_SHEET_PAGE_SIZES}
            value={pageSize}
            onChange={onPageSizeChange}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078] disabled:opacity-40"
            disabled={safePage === 0}
            type="button"
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
          >
            {pagination.prev}
          </button>
          <span className="min-w-[3.5rem] text-center text-[11px] font-semibold tabular-nums text-[#516078]">
            {safePage + 1}/{pageCount}
          </span>
          <button
            className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078] disabled:opacity-40"
            disabled={safePage >= pageCount - 1}
            type="button"
            onClick={() => onPageChange(Math.min(pageCount - 1, safePage + 1))}
          >
            {pagination.next}
          </button>
        </div>
      </footer>
    </FormSheet>
  );
}
