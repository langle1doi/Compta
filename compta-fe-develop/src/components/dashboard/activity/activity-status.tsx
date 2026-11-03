import {
  Check,
  CircleDollarSign,
  FilePen,
  Landmark,
  Send,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { ActivityStatus } from "@/features/activity/model";

const presentation: Record<ActivityStatus, { icon: LucideIcon; className: string }> = {
  accepted: { icon: Check, className: "bg-[#e7f6ee] text-[#0d6848]" },
  suggestion: { icon: Sparkles, className: "bg-[#f2edff] text-[#4a2f86]" },
  reconciled: { icon: Landmark, className: "bg-[#e7f6ee] text-[#0d6848]" },
  sent: { icon: Send, className: "bg-[#e7efff] text-[#0436a3]" },
  paid: { icon: CircleDollarSign, className: "bg-[#e7f6ee] text-[#0d6848]" },
  toApprove: { icon: ShieldCheck, className: "bg-[#fff4e6] text-[#7a430c]" },
  draft: { icon: FilePen, className: "bg-[#eef2f7] text-[#314158]" },
};

export function ActivityStatus({ status, label }: { status: ActivityStatus; label: string }) {
  const item = presentation[status];
  const Icon = item.icon;

  return (
    <span className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded-[7px] px-2 py-1 text-xs font-medium ${item.className}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export function activityIcon(status: ActivityStatus) {
  return presentation[status];
}
