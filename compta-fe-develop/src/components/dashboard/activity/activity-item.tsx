import type { ActivityItem } from "@/features/activity/model";

import { ActivityStatus, activityIcon } from "./activity-status";

export function ActivityItemRow({
  item,
  onOpen,
}: {
  item: ActivityItem;
  onOpen: (item: ActivityItem) => void;
}) {
  const icon = activityIcon(item.status);
  const Icon = icon.icon;

  return (
    <button
      className="activity-row grid w-full grid-cols-[3.25rem_2rem_minmax(0,1fr)] items-start gap-x-3 border-b border-[#eef2f7] px-5 py-3 text-left last:border-b-0"
      type="button"
      onClick={() => onOpen(item)}
    >
      <time className="pt-1 text-xs font-medium text-[#405069] tabular-nums" dateTime={item.timestamp}>
        {item.timeLabel}
      </time>
      <span className={`relative z-[1] grid h-8 w-8 place-items-center rounded-[11px] ${icon.className}`}>
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-[-0.01em] text-[#063586]">{item.title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[#66758d] tabular-nums">{item.metadata}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <ActivityStatus label={item.statusLabel} status={item.status} />
          {item.actor ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-[#66758d]">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f2f6fd] text-[11px] font-semibold text-[#24334c] ring-1 ring-[#e1e7f1]">
                {item.actor.initials}
              </span>
              <span className="truncate">{item.actor.name}</span>
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
