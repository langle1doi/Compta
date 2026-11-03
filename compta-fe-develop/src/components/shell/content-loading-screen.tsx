"use client";

import { useTranslations } from "next-intl";

/**
 * Single COMPTE content loading — skeleton shimmer only (no spinner / copy block).
 * Sidebar + topbar stay mounted; only main content shows this.
 */
export function ContentLoadingScreen() {
  const t = useTranslations("loading");

  return (
    <div
      aria-busy="true"
      aria-label={t("status")}
      className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div className="dashboard-page flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="shrink-0 space-y-2">
          <div className="loading-shimmer h-7 w-40 rounded-[8px]" />
          <div className="loading-shimmer h-4 max-w-[42ch] rounded-[6px]" />
        </div>

        <div className="dashboard-grid-2 dashboard-grid-2--kpi shrink-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="loading-shimmer h-[70px] rounded-[14px]" key={index} />
          ))}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:flex-row">
          <div className="dashboard-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3.5">
            <div className="loading-shimmer mb-3 h-9 w-full max-w-xl rounded-[10px]" />
            <div className="loading-shimmer mb-3 h-8 w-full rounded-[10px]" />
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div className="loading-shimmer h-11 rounded-[10px]" key={index} />
              ))}
            </div>
            <div className="loading-shimmer mt-3 h-9 w-full rounded-[10px]" />
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 xl:w-[300px]">
            <div className="loading-shimmer h-[200px] rounded-[14px]" />
            <div className="loading-shimmer h-[220px] rounded-[14px]" />
            <div className="loading-shimmer h-[88px] rounded-[14px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
