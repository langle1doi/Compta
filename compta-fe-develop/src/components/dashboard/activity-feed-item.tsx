import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Timeline row: date/time + rail node vertically centered to the event card.
 * Parent list should use `flex flex-col gap-3` so the connector can bridge the gap.
 */
export function ActivityFeedItem({
  dateLabel,
  timeLabel,
  isFirst = false,
  isLast,
  live = false,
  children,
  className,
  lineClassName = "bg-[#b7e0cd]",
  dotClassName,
}: {
  dateLabel: string;
  timeLabel: string;
  isFirst?: boolean;
  isLast: boolean;
  live?: boolean;
  children: ReactNode;
  className?: string;
  lineClassName?: string;
  /** Override rail dot color; defaults to green live/static invoice style. */
  dotClassName?: string;
}) {
  return (
    <li className={cn("min-w-0", className)}>
      <div className="grid min-w-0 grid-cols-[4.5rem_1rem_minmax(0,1fr)] items-center gap-x-2 sm:grid-cols-[5.5rem_1.25rem_minmax(0,1fr)] sm:gap-x-3">
        <div className="flex flex-col items-end justify-center text-right leading-tight">
          <p className="text-[12px] font-semibold text-[#24334c]">{dateLabel}</p>
          <p className="text-[11px] tabular-nums text-[#98a4b5]">{timeLabel}</p>
        </div>

        <div className="relative flex min-h-full items-center justify-center self-stretch">
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-1/2 w-0.5 -translate-x-1/2",
              isFirst ? "top-1/2" : "top-0",
              isLast ? "bottom-1/2" : "bottom-[-0.75rem]",
              lineClassName,
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              "relative z-[1] h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white sm:h-3 sm:w-3",
              dotClassName ?? "invoice-activity-dot",
              !dotClassName && live && "invoice-activity-dot--live",
            )}
          />
        </div>

        <div className="min-w-0">{children}</div>
      </div>
    </li>
  );
}
