"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { ActionItem, Tone } from "@/mocks/dashboard/types";

import { actionIcons } from "./action-list";
import {
  DashboardListSheetShell,
  listSheetPaginationCopy,
} from "./list-sheet/dashboard-list-sheet-shell";
import {
  usePagedListSheet,
  usePaginatedItems,
} from "./list-sheet/use-paged-list-sheet";
import { IconTile } from "./tone";

const TONE_FILTERS = ["all", "red", "orange", "blue", "purple", "green", "slate"] as const;
type ToneFilter = (typeof TONE_FILTERS)[number];

export function AttentionListSheet({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: ActionItem[];
  onClose: () => void;
}) {
  const t = useTranslations("attention.listFull");
  const allT = useTranslations();
  const paging = usePagedListSheet(open, "all" as ToneFilter);

  const filtered = useMemo(() => {
    const needle = paging.query.trim().toLowerCase();
    return items.filter((item) => {
      if (paging.filter !== "all" && item.tone !== paging.filter) return false;
      if (!needle) return true;
      const title = allT(item.titleKey, item.titleValues).toLowerCase();
      const meta = allT(item.metaKey, item.metaValues).toLowerCase();
      const action = allT(item.actionKey).toLowerCase();
      return title.includes(needle) || meta.includes(needle) || action.includes(needle);
    });
  }, [allT, items, paging.filter, paging.query]);

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
      filterLabel={t("filters.tone")}
      filterOptions={TONE_FILTERS.map((value) => ({
        value,
        label: value === "all" ? t("tone.all") : t(`tone.${value}`),
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
      onFilterChange={(value) => paging.updateFilter(value as ToneFilter)}
      onPageChange={paging.setPage}
      onPageSizeChange={paging.updatePageSize}
      onQueryChange={paging.updateQuery}
    >
      <ul className="dashboard-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3 sm:px-5">
        {visible.map((item) => {
          const Icon = actionIcons[item.icon];
          return (
            <li key={item.id}>
              <button
                className="action-motion soft-button flex min-h-[56px] w-full items-center gap-3 rounded-[12px] border border-[#e8eef6] bg-white px-3 py-2.5 text-left"
                type="button"
              >
                <IconTile size="sm" tone={item.tone as Tone} icon={Icon} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#24334c]">
                    {allT(item.titleKey, item.titleValues)}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[#7a899e]">
                    {allT(item.metaKey, item.metaValues)}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[#044ce2]">
                  {allT(item.actionKey)}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </DashboardListSheetShell>
  );
}
