"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import type { Invoice, InvoiceStatusKey } from "@/mocks/dashboard/types";

import {
  DashboardListSheetShell,
  listSheetCell as cell,
  listSheetPaginationCopy,
} from "./list-sheet/dashboard-list-sheet-shell";
import {
  usePagedListSheet,
  usePaginatedItems,
} from "./list-sheet/use-paged-list-sheet";

const STATUS_FILTERS = [
  "all",
  "status.overdue",
  "status.dueSoon",
  "status.partial",
  "status.open",
  "status.paid",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function InvoicesListSheet({
  open,
  invoices,
  onClose,
}: {
  open: boolean;
  invoices: Invoice[];
  onClose: () => void;
}) {
  const t = useTranslations("invoices.listFull");
  const invoicesT = useTranslations("invoices");
  const statusT = useTranslations();
  const paging = usePagedListSheet(open, "all" as StatusFilter);

  const filtered = useMemo(() => {
    const needle = paging.query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (paging.filter !== "all" && invoice.statusKey !== paging.filter) return false;
      if (!needle) return true;
      return (
        invoice.id.toLowerCase().includes(needle) ||
        invoice.customer.toLowerCase().includes(needle) ||
        invoice.balance.toLowerCase().includes(needle) ||
        invoice.due.toLowerCase().includes(needle)
      );
    });
  }, [invoices, paging.filter, paging.query]);

  const { pageCount, safePage, visible, rangeFrom, rangeTo } = usePaginatedItems(
    filtered,
    paging.page,
    paging.pageSize,
  );

  return (
    <DashboardListSheetShell
      clearFiltersLabel={t("clearFilters")}
      closeLabel={t("close")}
      emptyBody={t("emptyBody")}
      emptyTitle={t("emptyTitle")}
      filterLabel={t("filters.status")}
      filterOptions={STATUS_FILTERS.map((value) => ({
        value,
        label: value === "all" ? t("status.all") : statusT(value as InvoiceStatusKey),
      }))}
      filterValue={paging.filter}
      filtersActive={Boolean(paging.query.trim()) || paging.filter !== "all"}
      open={open}
      pageCount={pageCount}
      pageSize={paging.pageSize}
      pagination={listSheetPaginationCopy(t)}
      query={paging.query}
      rangeFrom={rangeFrom}
      rangeTo={rangeTo}
      safePage={safePage}
      searchLabel={t("search")}
      searchPlaceholder={t("searchPlaceholder")}
      subtitle={t("subtitle")}
      title={t("title")}
      totalCount={filtered.length}
      onClearFilters={paging.clearFilters}
      onClose={onClose}
      onFilterChange={(value) => paging.updateFilter(value as StatusFilter)}
      onPageChange={paging.setPage}
      onPageSizeChange={paging.updatePageSize}
      onQueryChange={paging.updateQuery}
    >
      <div className="hidden min-h-0 flex-1 overflow-auto lg:block">
        <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
          </colgroup>
          <thead className="dashboard-list__head sticky top-0 z-[1] bg-white">
            <tr>
              <th className={cell}>{t("columns.number")}</th>
              <th className={cell}>{t("columns.customer")}</th>
              <th className={cell}>{t("columns.due")}</th>
              <th className={`${cell} text-right`}>{t("columns.balance")}</th>
              <th className={cell}>{t("columns.status")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((invoice) => (
              <tr className="dashboard-list__row" key={invoice.id}>
                <td className={cell}>
                  <span className="dashboard-list__primary tabular-nums">{invoice.id}</span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__primary" title={invoice.customer}>
                    {invoice.customer}
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__secondary">
                    {invoicesT("due", { date: invoice.due })}
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__amount block truncate" title={invoice.balance}>
                    {invoice.balance}
                  </span>
                </td>
                <td className={cell}>
                  <StatusBadge size="xs" tone={invoice.tone}>
                    {statusT(invoice.statusKey)}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="dashboard-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3 lg:hidden sm:px-5">
        {visible.map((invoice) => (
          <li className="rounded-[12px] border border-[#e8eef6] bg-white p-3" key={invoice.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="dashboard-list__primary truncate tabular-nums">{invoice.id}</p>
                <p className="dashboard-list__secondary truncate">{invoice.customer}</p>
              </div>
              <StatusBadge size="xs" tone={invoice.tone}>
                {statusT(invoice.statusKey)}
              </StatusBadge>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#7d8aa0]">
              <span>{invoicesT("due", { date: invoice.due })}</span>
              <span className="dashboard-list__amount tabular-nums">{invoice.balance}</span>
            </div>
          </li>
        ))}
      </ul>
    </DashboardListSheetShell>
  );
}
