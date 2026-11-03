"use client";

import { Download } from "lucide-react";

import { cn } from "@/lib/utils";

/** Compact toolbar export control shared by COMPTE list pages. */
export function ExportCsvButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "action-motion soft-button grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-[#516078]",
        className,
      )}
      title={label}
      type="button"
      onClick={onClick}
    >
      <Download aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}
