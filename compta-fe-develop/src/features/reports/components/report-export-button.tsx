"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/features/settings/can";
import { cn } from "@/lib/utils";

import type { ExportResult } from "../export";

export function ReportExportButton({
  label,
  generatingLabel,
  onExport,
  className,
}: {
  label: string;
  generatingLabel: string;
  onExport: () => ExportResult;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const canExport = useCan()("report.read");

  if (!canExport) return null;

  return (
    <button
      aria-label={label}
      className={cn(
        "action-motion inline-flex h-8 shrink-0 items-center gap-1 rounded-[8px] px-2 text-[11px] font-semibold text-[#516078] hover:bg-[#f3f7ff] disabled:opacity-60",
        className,
      )}
      disabled={busy}
      type="button"
      onClick={() => {
        if (busy) return;
        setBusy(true);
        try {
          onExport();
        } finally {
          window.setTimeout(() => setBusy(false), 400);
        }
      }}
    >
      {busy ? (
        <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download aria-hidden="true" className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{busy ? generatingLabel : label}</span>
    </button>
  );
}
