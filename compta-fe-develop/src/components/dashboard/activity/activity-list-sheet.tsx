"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import {
  filterActivity,
  type ActivityFilter,
  type ActivityItem,
} from "@/features/activity/model";
import { cn } from "@/lib/utils";

import {
  DashboardListSheetShell,
  listSheetCell as cell,
  listSheetPaginationCopy,
} from "../list-sheet/dashboard-list-sheet-shell";
import {
  usePagedListSheet,
  usePaginatedItems,
} from "../list-sheet/use-paged-list-sheet";

const FILTERS: ActivityFilter[] = ["all", "quotes", "invoices", "payments", "system"];

export function ActivityListSheet({
  open,
  events,
  onClose,
  onOpenItem,
}: {
  open: boolean;
  events: ActivityItem[];
  onClose: () => void;
  onOpenItem: (item: ActivityItem) => void;
}) {
  const t = useTranslations("activity.listFull");
  const feedT = useTranslations("activity.feed");
  const paging = usePagedListSheet(open, "all" as ActivityFilter);

  const filtered = useMemo(() => {
    const byKind = filterActivity(events, paging.filter);
    const needle = paging.query.trim().toLowerCase();
    if (!needle) return byKind;
    return byKind.filter((item) => {
      return (
        item.title.toLowerCase().includes(needle) ||
        item.entityId.toLowerCase().includes(needle) ||
        item.metadata.toLowerCase().includes(needle) ||
        (item.amount?.toLowerCase().includes(needle) ?? false) ||
        (item.actor?.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [events, paging.filter, paging.query]);

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
      filterLabel={feedT("filtersLabel")}
      filterOptions={FILTERS.map((value) => ({
        value,
        label: feedT(`filters.${value}`),
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
      onFilterChange={(value) => paging.updateFilter(value as ActivityFilter)}
      onPageChange={paging.setPage}
      onPageSizeChange={paging.updatePageSize}
      onQueryChange={paging.updateQuery}
    >
      <div className="hidden min-h-0 flex-1 overflow-auto lg:block">
        <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            <col style={{ width: 90 }} />
            <col />
            <col style={{ width: 120 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 88 }} />
          </colgroup>
          <thead className="dashboard-list__head sticky top-0 z-[1] bg-white">
            <tr>
              <th className={cell}>{t("columns.time")}</th>
              <th className={cell}>{t("columns.event")}</th>
              <th className={cell}>{t("columns.reference")}</th>
              <th className={`${cell} text-right`}>{t("columns.amount")}</th>
              <th className={cell}>{t("columns.status")}</th>
              <th className={cell}>{t("columns.action")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr
                className="dashboard-list__row cursor-pointer"
                key={item.id}
                onClick={() => onOpenItem(item)}
              >
                <td className={cell}>
                  <span className="dashboard-list__secondary tabular-nums">{item.timeLabel}</span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__primary" title={item.title}>
                    {item.title}
                  </span>
                  <span className="dashboard-list__secondary" title={item.metadata}>
                    {item.metadata}
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__primary tabular-nums">{item.entityId}</span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__amount block truncate">
                    {item.amount ?? "—"}
                  </span>
                </td>
                <td className={cell}>
                  <StatusBadge size="xs" tone="slate">
                    {item.statusLabel}
                  </StatusBadge>
                </td>
                <td className={cell}>
                  <button
                    className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-xs font-semibold text-[#044ce2]"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenItem(item);
                    }}
                  >
                    {t("actions.view")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="dashboard-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3 lg:hidden sm:px-5">
        {visible.map((item) => (
          <li key={item.id}>
            <button
              className={cn(
                "action-motion soft-button flex w-full flex-col gap-2 rounded-[12px] border border-[#e8eef6] bg-white p-3 text-left",
              )}
              type="button"
              onClick={() => onOpenItem(item)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="dashboard-list__primary truncate">{item.title}</p>
                  <p className="dashboard-list__secondary truncate">{item.metadata}</p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-[#7d8aa0]">
                  {item.timeLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StatusBadge size="xs" tone="slate">
                  {item.statusLabel}
                </StatusBadge>
                <span className="dashboard-list__amount tabular-nums">
                  {item.amount ?? item.entityId}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </DashboardListSheetShell>
  );
}
