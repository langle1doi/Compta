"use client";

import { Download, FileSpreadsheet, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PageSizeSelect } from "@/components/compte/page-size-select";
import { FormSheet } from "@/components/forms/form-sheet";
import type { CsvCell } from "@/lib/csv-export";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  downloadCanonicalDataset,
  type CanonicalExportDataset,
  type ExportColumnDef,
  type ExportColumnKind,
} from "../export-dataset";

const pageSizeOptions = [10, 25, 50] as const;

type SortState = { columnId: string; direction: "asc" | "desc" } | null;

function cellText(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseMoneyEuro(value: CsvCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function parseNumber(value: CsvCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatPreviewCell(
  value: CsvCell,
  kind: ExportColumnKind,
  bucketLabel: (bucket: string) => string,
): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-[#98a4b5]">—</span>;
  }

  switch (kind) {
    case "money": {
      const cents = parseMoneyEuro(value);
      if (cents === null) return cellText(value);
      return (
        <span className="whitespace-nowrap tabular-nums">
          {formatMoneyFromCents(cents)}
        </span>
      );
    }
    case "delta_money": {
      const cents = parseMoneyEuro(value);
      if (cents === null) return cellText(value);
      const signed = cents > 0 ? `+${formatMoneyFromCents(cents)}` : formatMoneyFromCents(cents);
      return (
        <span
          className={cn(
            "whitespace-nowrap tabular-nums",
            cents > 0 && "text-[#1f7a45]",
            cents < 0 && "text-[#b54841]",
            cents === 0 && "text-[#7d8aa0]",
          )}
        >
          {signed}
        </span>
      );
    }
    case "percent": {
      const n = parseNumber(value);
      if (n === null) return cellText(value);
      return (
        <span className="whitespace-nowrap tabular-nums">{formatPercent(n / 100)}</span>
      );
    }
    case "delta_percent": {
      const n = parseNumber(value);
      if (n === null) return <span className="text-[#98a4b5]">—</span>;
      const signed = n > 0 ? `+${formatPercent(n / 100)}` : formatPercent(n / 100);
      return (
        <span
          className={cn(
            "whitespace-nowrap tabular-nums",
            n > 0 && "text-[#1f7a45]",
            n < 0 && "text-[#b54841]",
            n === 0 && "text-[#7d8aa0]",
          )}
        >
          {signed}
        </span>
      );
    }
    case "number":
      return (
        <span className="whitespace-nowrap tabular-nums">{cellText(value)}</span>
      );
    case "bucket":
      return bucketLabel(cellText(value));
    case "date":
    case "text":
    default:
      return cellText(value);
  }
}

function compareCells(
  a: CsvCell,
  b: CsvCell,
  kind: ExportColumnKind,
  direction: "asc" | "desc",
): number {
  const dir = direction === "asc" ? 1 : -1;
  if (kind === "money" || kind === "delta_money" || kind === "percent" || kind === "delta_percent" || kind === "number") {
    const na = parseNumber(a) ?? Number.NEGATIVE_INFINITY;
    const nb = parseNumber(b) ?? Number.NEGATIVE_INFINITY;
    return (na - nb) * dir;
  }
  return cellText(a).localeCompare(cellText(b), undefined, { sensitivity: "base" }) * dir;
}

export function ReportPreviewSheet({
  open,
  title,
  description,
  icon,
  dataset,
  filterSummary,
  canExport,
  onClose,
  onEmptyExport,
  onExported,
}: {
  open: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  dataset: CanonicalExportDataset | null;
  filterSummary?: string;
  canExport: boolean;
  onClose: () => void;
  onEmptyExport: () => void;
  onExported?: () => void;
}) {
  const t = useTranslations("reports.preview");
  const agingT = useTranslations("reports.aging.buckets");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<SortState>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setQuery("");
      setPage(0);
      setPageSize(10);
      setSort(null);
    }
    wasOpen.current = open;
  }, [open]);

  const columns = useMemo(() => dataset?.columns ?? [], [dataset]);
  const canonicalRows = useMemo(() => dataset?.rows ?? [], [dataset]);
  const searchableIndexes = useMemo(
    () =>
      columns
        .map((column, index) => (column.searchable ? index : -1))
        .filter((index) => index >= 0),
    [columns],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = canonicalRows;
    if (q) {
      rows = canonicalRows.filter((row) =>
        searchableIndexes.some((index) => cellText(row[index]).toLowerCase().includes(q)),
      );
    }
    if (sort) {
      const colIndex = columns.findIndex((column) => column.id === sort.columnId);
      if (colIndex >= 0) {
        const kind = columns[colIndex]?.kind ?? "text";
        rows = [...rows].sort((a, b) =>
          compareCells(a[colIndex], b[colIndex], kind, sort.direction),
        );
      }
    }
    return rows;
  }, [canonicalRows, columns, query, searchableIndexes, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filteredRows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeFrom = filteredRows.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeTo = Math.min(filteredRows.length, (safePage + 1) * pageSize);
  const isEmpty = canonicalRows.length === 0;
  const exportDisabled = isEmpty || !canExport || !dataset;

  function bucketLabel(bucket: string) {
    if (
      bucket === "current" ||
      bucket === "d1_30" ||
      bucket === "d31_60" ||
      bucket === "d61_90" ||
      bucket === "d90_plus"
    ) {
      return agingT(bucket);
    }
    return bucket;
  }

  function toggleSort(column: ExportColumnDef) {
    setPage(0);
    setSort((current) => {
      if (!current || current.columnId !== column.id) {
        return { columnId: column.id, direction: "asc" };
      }
      if (current.direction === "asc") return { columnId: column.id, direction: "desc" };
      return null;
    });
  }

  function handleExport() {
    if (!dataset || exportDisabled) {
      if (isEmpty) onEmptyExport();
      return;
    }
    const result = downloadCanonicalDataset(dataset);
    if (!result.ok) onEmptyExport();
    else onExported?.();
  }

  return (
    <FormSheet
      closeLabel={t("close")}
      contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="action-motion soft-button inline-flex h-10 items-center rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            type="button"
            onClick={onClose}
          >
            {t("close")}
          </button>
        </div>
      }
      open={open}
      showHeader={false}
      title={title}
      widthClassName="sm:min-w-[min(100%,620px)] sm:max-w-[min(100%,920px)] lg:max-w-[min(48vw,920px)] md:max-lg:max-w-[min(85vw,920px)]"
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e8eef6] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#063586]">{title}</h2>
              <p className="mt-1 text-sm leading-5 text-[#728097]">{description}</p>
            </div>
          </div>
          <button
            aria-label={t("close")}
            className="soft-button grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[#506078]"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="dashboard-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5">
          {dataset ? (
            <div className="flex flex-wrap items-start gap-3 rounded-[12px] border border-[#edf2f8] bg-[#fbfcfe] px-3 py-2.5">
              <FileSpreadsheet aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#044ce2]" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#98a4b5]">
                  {t("fileInfo")}
                </p>
                <p className="mt-0.5 break-all text-sm font-semibold text-[#24334c]">
                  {dataset.filename}
                </p>
                <p className="mt-0.5 text-[11px] text-[#7d8aa0]">{t("generatedWithFilters")}</p>
                {filterSummary ? (
                  <p className="mt-1 text-[11px] text-[#516078]">{filterSummary}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 text-right text-[11px] font-semibold tabular-nums text-[#405069]">
                <span className="rounded-[6px] bg-[#eef3fb] px-1.5 py-0.5 text-[#044ce2]">CSV</span>
                <span>
                  {query.trim()
                    ? t("visibleRows", { visible: filteredRows.length, total: canonicalRows.length })
                    : t("rowCount", { count: canonicalRows.length })}
                </span>
                <span>{t("columnCount", { count: columns.length })}</span>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t("search")}</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#98a4b5]"
              />
              <input
                ref={searchRef}
                aria-label={t("search")}
                className="compte-search-input soft-input h-10 w-full rounded-[10px] pr-3 pl-8 text-sm text-[#24334c] outline-none placeholder:text-[#98a4b5]"
                disabled={isEmpty}
                placeholder={t("search")}
                type="search"
                value={query}
                onChange={(event) => {
                  setPage(0);
                  setQuery(event.target.value);
                }}
              />
            </label>
            {canExport ? (
              <button
                aria-label={t("exportCsvAria")}
                className="action-motion soft-primary inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={exportDisabled}
                type="button"
                onClick={handleExport}
              >
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                {t("exportCsv")}
              </button>
            ) : null}
          </div>

          {isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[12px] border border-dashed border-[#e1e7f1] px-4 py-10 text-center">
              <p className="text-sm font-semibold text-[#24334c]">{t("emptyTitle")}</p>
              <p className="mt-1 max-w-sm text-xs text-[#7d8aa0]">{t("emptyBody")}</p>
            </div>
          ) : (
            <>
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-[12px] border border-[#edf2f8]">
                <div className="report-preview-table-scroll max-h-[min(52vh,520px)] overflow-auto">
                  <table className="w-max min-w-full border-collapse text-left text-[11px]">
                    <thead className="sticky top-0 z-[1] bg-[#f7f9fc]">
                      <tr>
                        {columns.map((column) => {
                          const active = sort?.columnId === column.id;
                          return (
                            <th
                              className="border-b border-[#edf2f8] px-2.5 py-2 text-[10px] font-semibold tracking-[0.02em] whitespace-nowrap text-[#7d8aa0] uppercase"
                              key={column.id}
                              scope="col"
                            >
                              <button
                                className="inline-flex items-center gap-1 whitespace-nowrap hover:text-[#405069]"
                                type="button"
                                onClick={() => toggleSort(column)}
                              >
                                {t(`columns.${column.labelKey}`)}
                                {active ? (
                                  <span className="tabular-nums text-[#044ce2]">
                                    {sort.direction === "asc" ? "↑" : "↓"}
                                  </span>
                                ) : null}
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row, rowIndex) => (
                        <tr
                          className="border-b border-[#f1f4f8] last:border-b-0"
                          key={`${safePage}-${rowIndex}`}
                        >
                          {columns.map((column, colIndex) => (
                            <td
                              className={cn(
                                "px-2.5 py-2 align-middle whitespace-nowrap text-[#24334c]",
                                (column.kind === "money" ||
                                  column.kind === "percent" ||
                                  column.kind === "number" ||
                                  column.kind === "delta_money" ||
                                  column.kind === "delta_percent") &&
                                  "text-right tabular-nums",
                              )}
                              key={column.id}
                            >
                              {formatPreviewCell(row[colIndex], column.kind, bucketLabel)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-[11px] tabular-nums text-[#7d8aa0]">
                    {t("pagination.summary", {
                      from: rangeFrom,
                      to: rangeTo,
                      total: filteredRows.length,
                    })}
                  </p>
                  <PageSizeSelect
                    formatOption={(count) =>
                      t("pagination.rowsPerPage", { count })
                    }
                    label={t("pagination.pageSize")}
                    options={pageSizeOptions}
                    value={pageSize}
                    onChange={(size) => {
                      setPage(0);
                      setPageSize(size);
                    }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078] disabled:opacity-40"
                    disabled={safePage === 0}
                    type="button"
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    {t("pagination.prev")}
                  </button>
                  <span className="min-w-[3.5rem] text-center text-[11px] font-semibold tabular-nums text-[#516078]">
                    {safePage + 1}/{pageCount}
                  </span>
                  <button
                    className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078] disabled:opacity-40"
                    disabled={safePage >= pageCount - 1}
                    type="button"
                    onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                  >
                    {t("pagination.next")}
                  </button>
                </div>
              </footer>

              <p className="text-[10px] leading-4 text-[#98a4b5]">{t("footerNote")}</p>
            </>
          )}
        </div>
      </div>
    </FormSheet>
  );
}
