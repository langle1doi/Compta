"use client";

import {
  CircleDollarSign,
  Clock3,
  FileText,
  Mail,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { ActivityFeedItem } from "@/components/dashboard/activity-feed-item";
import { IconTile, StatusBadge } from "@/components/dashboard/tone";
import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  activityDescription,
  activityFiltersFor,
  activityTitle,
  activityTone,
  filterCustomerActivity,
} from "../customer-history";
import type { CustomerActivity, CustomerActivityFilter, CustomerRecord } from "../types";
import { CustomerHistoryEmpty } from "./customer-history-empty";

function formatTimelineDate(iso: string, locale: string, todayLabel: string) {
  const date = new Date(iso);
  const today = new Date("2026-10-05T12:00:00.000Z");
  const sameDay =
    date.getUTCFullYear() === today.getUTCFullYear() &&
    date.getUTCMonth() === today.getUTCMonth() &&
    date.getUTCDate() === today.getUTCDate();
  if (sameDay) return todayLabel;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTimelineTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function activityIcon(kind: CustomerActivity["kind"]) {
  if (kind.startsWith("quote_")) return FileText;
  if (kind.startsWith("invoice_")) return ReceiptText;
  if (kind.startsWith("payment_")) return CircleDollarSign;
  if (kind === "email_sent") return Mail;
  return UserRound;
}

export function CustomerActivityTab({ customer }: { customer: CustomerRecord }) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const availableFilters = useMemo(
    () => activityFiltersFor(customer.activity),
    [customer.activity],
  );
  const [filter, setFilter] = useState<CustomerActivityFilter>("all");
  const activeFilter = availableFilters.includes(filter) ? filter : "all";
  const items = useMemo(
    () => filterCustomerActivity(customer.activity, activeFilter),
    [activeFilter, customer.activity],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-[1] flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#edf2f8] bg-white/95 px-0.5 py-2 backdrop-blur-sm">
        <h3 className="text-[13px] font-semibold text-[#24334c]">
          {t("historyTabs.activityTitle")}
        </h3>
        {availableFilters.length > 1 ? (
          <label className="flex min-w-0 items-center gap-1.5">
            <span className="sr-only">{t("historyTabs.activityFilter")}</span>
            <select
              className="soft-input h-8 max-w-[11rem] rounded-[8px] px-2 text-[11px] font-semibold text-[#405069] outline-none focus:ring-[3px] focus:ring-[#044ce2]/20"
              value={activeFilter}
              onChange={(event) => setFilter(event.target.value as CustomerActivityFilter)}
            >
              {availableFilters.map((value) => (
                <option key={value} value={value}>
                  {t(`historyTabs.filters.${value}`)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {items.length === 0 ? (
        <CustomerHistoryEmpty
          body={t("historyTabs.activityEmptyBody")}
          icon={Clock3}
          title={t("historyTabs.activityEmptyTitle")}
        />
      ) : (
        <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2">
          {items.map((item, index) => {
            const Icon = activityIcon(item.kind);
            const tone = activityTone(item.kind);
            const description = activityDescription(item);
            const amount =
              item.amountCents != null ? formatMoneyFromCents(item.amountCents) : null;
            return (
              <ActivityFeedItem
                dateLabel={formatTimelineDate(item.at, locale, t("relative.today"))}
                dotClassName={cn(
                  tone === "purple" && "bg-[#7b61c8]",
                  tone === "green" && "bg-[#238567]",
                  tone === "orange" && "bg-[#b96d24]",
                  tone === "blue" && "bg-[#044ce2]",
                  tone === "slate" && "bg-[#98a4b5]",
                )}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                key={item.id}
                lineClassName="bg-[#d9e3f0]"
                timeLabel={formatTimelineTime(item.at, locale)}
              >
                <article className="min-w-0 rounded-[10px] bg-white px-2 py-1.5 transition-colors hover:bg-[#f7faff]">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconTile icon={Icon} size="sm" tone={tone} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <p className="min-w-0 text-xs font-semibold text-[#24334c]">
                          {activityTitle(item)}
                        </p>
                        {item.actorName ? (
                          <StatusBadge size="xs" tone="slate">
                            {item.actorName}
                          </StatusBadge>
                        ) : null}
                      </div>
                      {description || amount || item.relatedLabel ? (
                        <p className="mt-0.5 text-[11px] leading-4 text-[#7d8aa0]">
                          {[amount, description, item.relatedLabel]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              </ActivityFeedItem>
            );
          })}
        </ol>
      )}
    </div>
  );
}
