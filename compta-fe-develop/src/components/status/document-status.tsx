"use client";

import {
  Check,
  Clock3,
  FilePen,
  Send,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { QuoteStatus } from "@/features/quotes/model";

const presentation: Record<
  QuoteStatus,
  { icon: LucideIcon; className: string }
> = {
  draft: { icon: FilePen, className: "bg-[#eef2f7] text-[#314158]" },
  sent: { icon: Send, className: "bg-[#e7efff] text-[#0436a3]" },
  review: { icon: ShieldCheck, className: "bg-[#fff4e6] text-[#7a430c]" },
  accepted: { icon: Check, className: "bg-[#e7f6ee] text-[#0d6848]" },
  rejected: { icon: X, className: "bg-[#fdeceb] text-[#8e2a26]" },
  expired: { icon: Clock3, className: "bg-[#eef2f7] text-[#314158]" },
};

export function DocumentStatus({ status }: { status: QuoteStatus }) {
  const t = useTranslations("status");
  const item = presentation[status];
  const Icon = item.icon;
  const label = t(status);

  return (
    <span
      className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded-[7px] px-2 py-1 text-xs font-medium ${item.className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
