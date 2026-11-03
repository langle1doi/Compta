"use client";

import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/** Compact-rail tooltip — portals so sidebar overflow does not clip it. */
export function SidebarTooltip({
  label,
  enabled,
  children,
  side = "right",
  className,
}: {
  label: string;
  enabled: boolean;
  children: ReactNode;
  side?: "right" | "bottom";
  className?: string;
}) {
  const tipId = useId();
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  // Drop stale tip coords when the host disables tooltips (e.g. company menu).
  if (!enabled && coords !== null) {
    setCoords(null);
  }

  if (!enabled) return <>{children}</>;

  return (
    <span
      className={cn("relative flex w-full max-w-full justify-center", className)}
      onMouseEnter={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setCoords(
          side === "bottom"
            ? { top: rect.bottom + 8, left: rect.left + rect.width / 2 }
            : { top: rect.top + rect.height / 2, left: rect.right + 10 },
        );
      }}
      onMouseLeave={() => setCoords(null)}
    >
      <span
        aria-describedby={coords ? tipId : undefined}
        className="flex max-w-full justify-center"
      >
        {children}
      </span>
      {coords && typeof document !== "undefined"
        ? createPortal(
            <span
              className={cn(
                "pointer-events-none fixed z-[120] rounded-[8px] bg-[#14233f] px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap text-white shadow-[0_10px_24px_rgb(10_25_50/0.22)]",
                side === "bottom" && "-translate-x-1/2",
                side === "right" && "-translate-y-1/2",
              )}
              id={tipId}
              role="tooltip"
              style={{ top: coords.top, left: coords.left }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
