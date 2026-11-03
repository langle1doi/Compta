"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export const LIST_SHEET_PAGE_SIZES = [10, 25, 50] as const;

export function usePagedListSheet<TFilter extends string>(
  open: boolean,
  defaultFilter: TFilter,
) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TFilter>(defaultFilter);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(LIST_SHEET_PAGE_SIZES[0]);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setQuery("");
      setFilter(defaultFilter);
      setPage(0);
      setPageSize(LIST_SHEET_PAGE_SIZES[0]);
    }
    wasOpen.current = open;
  }, [defaultFilter, open]);

  function updateQuery(value: string) {
    setPage(0);
    setQuery(value);
  }

  function updateFilter(value: TFilter) {
    setPage(0);
    setFilter(value);
  }

  function updatePageSize(size: number) {
    setPage(0);
    setPageSize(size);
  }

  function clearFilters() {
    setQuery("");
    setFilter(defaultFilter);
    setPage(0);
  }

  return {
    query,
    filter,
    page,
    pageSize,
    setPage,
    updateQuery,
    updateFilter,
    updatePageSize,
    clearFilters,
  };
}

export function paginateList<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = items.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeFrom = items.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeTo = Math.min(items.length, (safePage + 1) * pageSize);

  return { pageCount, safePage, visible, rangeFrom, rangeTo };
}

export function usePaginatedItems<T>(items: T[], page: number, pageSize: number) {
  return useMemo(() => paginateList(items, page, pageSize), [items, page, pageSize]);
}
