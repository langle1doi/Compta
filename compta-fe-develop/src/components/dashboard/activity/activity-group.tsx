import type { ActivityGroupModel, ActivityItem } from "@/features/activity/model";

import { ActivityItemRow } from "./activity-item";

export function ActivityGroup({
  group,
  label,
  countLabel,
  onOpen,
}: {
  group: ActivityGroupModel;
  label: string;
  countLabel: string;
  onOpen: (item: ActivityItem) => void;
}) {
  return (
    <section aria-label={label}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-1">
        <h3 className="text-sm font-semibold tracking-[-0.01em] text-[#063586]">{label}</h3>
        <p className="text-xs text-[#66758d] tabular-nums">{countLabel}</p>
      </div>
      <div className="relative">
        <span aria-hidden="true" className="activity-line absolute top-3 bottom-3 w-px bg-[#e1e7f1]" />
        {group.items.map((item) => (
          <ActivityItemRow item={item} key={item.id} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
