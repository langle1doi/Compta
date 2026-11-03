"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ReportCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  empty,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  return (
    <section
      className={cn(
        "dashboard-card dashboard-list flex min-h-0 min-w-0 flex-col overflow-hidden",
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[rgb(220_229_239/0.72)] px-3.5 py-2.5 sm:px-4">
        <div className="min-w-0">
          <h2 className="dashboard-card-title truncate">{title}</h2>
          {subtitle ? (
            <p className="dashboard-label mt-0.5 line-clamp-2 text-[11px] sm:text-xs">{subtitle}</p>
          ) : null}
        </div>
        {action ? (
          <div className="flex max-w-[58%] shrink-0 flex-nowrap items-center justify-end gap-1.5 max-sm:flex-wrap">
            {action}
          </div>
        ) : null}
      </div>
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-[#24334c]">{emptyTitle}</p>
          {emptyBody ? (
            <p className="max-w-[36ch] text-[11px] leading-5 text-[#7d8aa0]">{emptyBody}</p>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col px-3.5 py-3 sm:px-4",
            bodyClassName,
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}
