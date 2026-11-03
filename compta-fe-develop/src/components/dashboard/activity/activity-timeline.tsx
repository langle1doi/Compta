import type { ActivityGroupModel, ActivityItem } from "@/features/activity/model";

import { ActivityGroup } from "./activity-group";

export function ActivityTimeline({
  groups,
  dayLabel,
  countLabel,
  emptyTitle,
  emptyBody,
  onOpen,
}: {
  groups: ActivityGroupModel[];
  dayLabel: (day: ActivityGroupModel["day"]) => string;
  countLabel: (count: number) => string;
  emptyTitle: string;
  emptyBody: string;
  onOpen: (item: ActivityItem) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="px-5 py-8">
        <p className="text-sm font-semibold text-[#063586]">{emptyTitle}</p>
        <p className="mt-1 max-w-[46ch] text-sm leading-6 text-[#66758d]">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div id="activity-timeline">
      {groups.map((group) => (
        <ActivityGroup
          countLabel={countLabel(group.items.length)}
          group={group}
          key={group.day}
          label={dayLabel(group.day)}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
