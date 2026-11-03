import { ChevronRight, CircleAlert, FileCheck2, Landmark, type LucideIcon } from "lucide-react";

import type { AttentionItem } from "@/features/activity/model";

const icons: Record<AttentionItem["kind"], LucideIcon> = {
  invoice: CircleAlert,
  quote: FileCheck2,
  reconciliation: Landmark,
};

const tones: Record<AttentionItem["kind"], string> = {
  invoice: "bg-[#fff0ed] text-[#8e2a26]",
  quote: "bg-[#fff4e6] text-[#7a430c]",
  reconciliation: "bg-[#e7efff] text-[#0436a3]",
};

export function AttentionItemRow({
  item,
  onOpen,
}: {
  item: AttentionItem;
  onOpen: (item: AttentionItem) => void;
}) {
  const Icon = icons[item.kind];

  return (
    <button className="activity-row flex w-full items-center gap-3 px-4 py-3 text-left" type="button" onClick={() => onOpen(item)}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[11px] ${tones[item.kind]}`}>
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#063586]">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs leading-5 text-[#66758d] tabular-nums">{item.metadata}</span>
      </span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#66758d]" />
    </button>
  );
}
