"use client";

import { useNestedScrollChain } from "@/lib/use-nested-scroll-chain";

import { Bell, CircleAlert, FileText, Landmark } from "lucide-react";
import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import { IconTile } from "@/components/dashboard/tone";
import type { Tone } from "@/mocks/dashboard/types";

import { automationLabel } from "../label";
import type { AutomationDefinition, AutomationReviewItem } from "../model";

const reviewIcon = {
  bank_match: Landmark,
  reminder_draft: Bell,
  quote_follow_up_draft: FileText,
} as const;

const reviewTone: Record<AutomationReviewItem["type"], Tone> = {
  bank_match: "blue",
  reminder_draft: "orange",
  quote_follow_up_draft: "purple",
};

function formatWhen(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function NeedsAttentionPanel({
  items,
  automations,
  onReview,
  limit,
}: {
  items: AutomationReviewItem[];
  automations: AutomationDefinition[];
  onReview?: (item: AutomationReviewItem) => void;
  /** Cap visible items on Overview; badge still shows total open count. */
  limit?: number;
}) {
  const t = useTranslations("automation");
  const listScrollRef = useRef<HTMLUListElement>(null);
  useNestedScrollChain(listScrollRef);
  const locale = useLocale();
  const openItems = items.filter((item) => item.status === "open");
  const visibleItems =
    typeof limit === "number" ? openItems.slice(0, Math.max(0, limit)) : openItems;
  const byId = new Map(automations.map((item) => [item.id, item]));

  return (
    <section className="dashboard-card flex h-[min(420px,52vh)] min-h-[280px] min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[#edf2f8] px-3.5 py-2.5">
        <h2 className="dashboard-card-title flex items-center gap-1.5">
          <CircleAlert aria-hidden="true" className="h-3.5 w-3.5 text-[#b96d24]" />
          {t("attention.title")}
          {openItems.length > 0 ? (
            <span className="rounded-full bg-[#fff1df] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#b96d24]">
              {openItems.length}
            </span>
          ) : null}
        </h2>
        <p className="dashboard-label mt-0.5 text-[11px]">{t("attention.subtitle")}</p>
      </div>

      {openItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[#24334c]">{t("attention.emptyTitle")}</p>
          <p className="max-w-[36ch] text-[11px] leading-5 text-[#7d8aa0]">
            {t("attention.emptyBody")}
          </p>
        </div>
      ) : (
        <ul ref={listScrollRef} className="dashboard-scroll--chain dashboard-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2.5">
          {visibleItems.map((item) => {
            const Icon = reviewIcon[item.type];
            const automation = byId.get(item.automationId);
            return (
              <li
                className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#edf2f8] bg-[#fbfcfe] px-2.5 py-2"
                key={item.id}
              >
                <IconTile icon={Icon} size="xs" tone={reviewTone[item.type]} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[#24334c]">
                    {t(item.titleKey, item.titleParams)}
                  </p>
                  <p className="text-[10px] text-[#7d8aa0]">{t(item.reasonKey)}</p>
                  <p className="mt-0.5 text-[10px] text-[#98a4b5]">
                    {automation ? automationLabel(automation, t) : item.entityLabel} ·{" "}
                    <span className="tabular-nums">{formatWhen(item.createdAt, locale)}</span>
                  </p>
                </div>
                {onReview ? (
                  <button
                    className="action-motion soft-primary h-8 shrink-0 rounded-[8px] px-2.5 text-[10px] font-semibold text-white"
                    type="button"
                    onClick={() => onReview(item)}
                  >
                    {t("attention.review")}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
