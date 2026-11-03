"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import type { Quote, QuoteStatusKey } from "@/mocks/dashboard/types";
import { cn } from "@/lib/utils";

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
  "status.draft",
  "status.sent",
  "status.review",
  "status.accepted",
  "status.rejected",
  "status.expired",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

export function QuotesListSheet({
  open,
  quotes,
  onClose,
  onOpenQuote,
}: {
  open: boolean;
  quotes: Quote[];
  onClose: () => void;
  onOpenQuote: (id: string) => void;
}) {
  const t = useTranslations("quotes.listFull");
  const quotesT = useTranslations("quotes");
  const statusT = useTranslations();
  const paging = usePagedListSheet(open, "all" as StatusFilter);

  const filtered = useMemo(() => {
    const needle = paging.query.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (paging.filter !== "all" && quote.statusKey !== paging.filter) return false;
      if (!needle) return true;
      const work = statusT(quote.workKey).toLowerCase();
      return (
        quote.id.toLowerCase().includes(needle) ||
        quote.customer.toLowerCase().includes(needle) ||
        quote.owner.toLowerCase().includes(needle) ||
        quote.amount.toLowerCase().includes(needle) ||
        work.includes(needle)
      );
    });
  }, [paging.filter, paging.query, quotes, statusT]);

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
        label: value === "all" ? t("status.all") : statusT(value as QuoteStatusKey),
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
            <col style={{ width: 120 }} />
            <col />
            <col style={{ width: 72 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 88 }} />
          </colgroup>
          <thead className="dashboard-list__head sticky top-0 z-[1] bg-white">
            <tr>
              <th className={cell}>{quotesT("number")}</th>
              <th className={cell}>{quotesT("customer")}</th>
              <th className={cell}>{quotesT("owner")}</th>
              <th className={`${cell} text-right`}>{quotesT("total")}</th>
              <th className={cell}>{quotesT("status")}</th>
              <th className={cell}>{t("columns.action")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((quote) => {
              const work = statusT(quote.workKey);
              return (
                <tr
                  className="dashboard-list__row cursor-pointer"
                  key={quote.id}
                  onClick={() => onOpenQuote(quote.id)}
                >
                  <td className={cell}>
                    <button
                      className="dashboard-list__primary dashboard-list__link max-w-full text-left tabular-nums"
                      title={quote.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenQuote(quote.id);
                      }}
                    >
                      {quote.id}
                    </button>
                  </td>
                  <td className={cell}>
                    <span className="dashboard-list__primary" title={quote.customer}>
                      {quote.customer}
                    </span>
                    <span className="dashboard-list__secondary" title={work}>
                      {work}
                    </span>
                  </td>
                  <td className={cell}>
                    <span className="dashboard-list__avatar" title={quote.owner}>
                      {quote.owner}
                    </span>
                  </td>
                  <td className={cell}>
                    <span className="dashboard-list__amount block truncate" title={quote.amount}>
                      {quote.amount}
                    </span>
                  </td>
                  <td className={cell}>
                    <StatusBadge className="dashboard-list__badge max-w-full" size="xs" tone={quote.tone}>
                      {statusT(quote.statusKey)}
                    </StatusBadge>
                  </td>
                  <td className={cell}>
                    <button
                      className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-xs font-semibold text-[#044ce2]"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenQuote(quote.id);
                      }}
                    >
                      {t("actions.view")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="dashboard-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3 lg:hidden sm:px-5">
        {visible.map((quote) => {
          const work = statusT(quote.workKey);
          return (
            <li key={quote.id}>
              <button
                className={cn(
                  "action-motion soft-button flex w-full flex-col gap-2 rounded-[12px] border border-[#e8eef6] bg-white p-3 text-left",
                )}
                type="button"
                onClick={() => onOpenQuote(quote.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="dashboard-list__primary truncate tabular-nums">{quote.id}</p>
                    <p className="dashboard-list__secondary truncate">{quote.customer}</p>
                  </div>
                  <StatusBadge size="xs" tone={quote.tone}>
                    {statusT(quote.statusKey)}
                  </StatusBadge>
                </div>
                <p className="truncate text-[11px] text-[#7d8aa0]">{work}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="dashboard-list__avatar" title={quote.owner}>
                    {quote.owner}
                  </span>
                  <span className="dashboard-list__amount tabular-nums">{quote.amount}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </DashboardListSheetShell>
  );
}
