"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { IntegrationDisplayStatus } from "../model";
import { statusLabelKey } from "../status";

const statusClass: Record<IntegrationDisplayStatus, string> = {
  connected: "bg-[#eaf9f1] text-[#148455]",
  ready: "bg-[#edf4ff] text-[#2468d8]",
  attention: "bg-[#fff5df] text-[#b76b0d]",
  coming_soon: "bg-[#f3f5f8] text-[#778397]",
};

export function IntegrationStatusBadge({
  status,
  className,
}: {
  status: IntegrationDisplayStatus;
  className?: string;
}) {
  const t = useTranslations("integrations");
  const label = t(statusLabelKey(status));

  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full min-w-0 items-center overflow-hidden rounded-full px-[9px] text-[11px] font-semibold",
        statusClass[status],
        className,
      )}
      title={label}
    >
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
