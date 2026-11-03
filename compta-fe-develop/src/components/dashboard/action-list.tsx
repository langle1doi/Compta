"use client";

import {
  CalendarClock,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  FileCheck2,
  Hourglass,
  Landmark,
  Reply,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { ActionIconName, ActionItem } from "@/mocks/dashboard/types";

import { DashboardScroll } from "./dashboard-scroll";
import { IconTile } from "./tone";

const actionIcons: Record<ActionIconName, LucideIcon> = {
  clock: CircleAlert,
  shield: FileCheck2,
  wallet: Landmark,
  file: Hourglass,
  receipt: CircleDollarSign,
  mail: Reply,
  calendar: CalendarClock,
};

const visibleEnter = ["enter-140", "enter-190", "enter-240"];

export function ActionList({
  items,
  animate = true,
}: {
  items: ActionItem[];
  animate?: boolean;
}) {
  const t = useTranslations();

  return (
    <DashboardScroll>
      {items.length === 0 ? (
        <p className="py-6 text-sm text-[#728097]">{t("attention.empty")}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, itemIndex) => {
            const Icon = actionIcons[item.icon];
            const enterClass = animate
              ? (visibleEnter[itemIndex] ?? "attention-settled")
              : "attention-settled";

            return (
              <button
                className={`attention-card soft-list-item flex min-h-[42px] w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left ${enterClass}`}
                key={item.id}
                type="button"
              >
                <IconTile className="attention-icon" size="xs" tone={item.tone} icon={Icon} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] leading-tight font-semibold text-[#24334c]">
                    {t(item.titleKey, item.titleValues)}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] leading-tight text-[#7a899e]">
                    {t(item.metaKey, item.metaValues)}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold text-[#044ce2]">
                  {t(item.actionKey)}
                  <ChevronRight className="attention-arrow h-3 w-3" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </DashboardScroll>
  );
}

export { actionIcons };
