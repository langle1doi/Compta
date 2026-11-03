"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { SoftSelect } from "@/components/compte/soft-select";

import type { IntegrationSort } from "../model";

export function IntegrationFilters({
  search,
  sort,
  onSearchChange,
  onSortChange,
}: {
  search: string;
  sort: IntegrationSort;
  onSearchChange: (value: string) => void;
  onSortChange: (value: IntegrationSort) => void;
}) {
  const t = useTranslations("integrations");

  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end xl:w-auto">
      <label className="relative block w-full min-w-0 sm:max-w-[320px] xl:w-[300px]">
        <span className="sr-only">{t("search")}</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#98a4b5]"
        />
        <input
          className="compte-search-input h-9 w-full rounded-[10px] border border-[#dce6f3] bg-white/90 pr-3 pl-9 text-[12px] text-[#24334c] outline-none placeholder:text-[#98a4b5]"
          placeholder={t("search")}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
      <SoftSelect
        className="w-full sm:w-[180px]"
        hideLabel
        label={t("sort.label")}
        options={[
          { value: "recommended", label: t("sort.recommended") },
          { value: "name", label: t("sort.name") },
          { value: "connected_first", label: t("sort.connectedFirst") },
          { value: "category", label: t("sort.category") },
        ]}
        triggerClassName="h-9 rounded-[10px] text-[12px]"
        value={sort}
        onChange={(value) => onSortChange(value as IntegrationSort)}
      />
    </div>
  );
}
