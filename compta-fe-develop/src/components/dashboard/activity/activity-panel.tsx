"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { NestedScrollChain } from "@/components/dashboard/dashboard-scroll";
import { formatMoneyFromCents } from "@/lib/money";
import {
  filterActivity,
  groupActivity,
  type ActivityFilter,
  type ActivityItem,
  type ActivityStatus,
  type AttentionItem,
} from "@/features/activity/model";
import {
  activityEvents,
  activityTip,
  attentionFeed,
  type ActivityEventSource,
  type AttentionSource,
} from "@/mocks/dashboard/activity-feed";

import { ActivityListSheet } from "./activity-list-sheet";
import { ActivityPreview, type ActivityPreviewModel } from "./activity-preview";
import { ActivitySkeleton } from "./activity-skeleton";
import { ActivityTimeline } from "./activity-timeline";
import { AssistantSuggestion } from "./assistant-suggestion";
import { AttentionList } from "./attention-list";
import { TipCard } from "./tip-card";

const filters: ActivityFilter[] = ["all", "quotes", "invoices", "payments", "system"];

function statusLabel(status: ActivityStatus, activity: ReturnType<typeof useTranslations>, documentStatus: ReturnType<typeof useTranslations>) {
  if (status === "suggestion") return activity("feed.status.suggestion");
  if (status === "reconciled") return activity("feed.status.reconciled");
  if (status === "toApprove") return documentStatus("review");
  return documentStatus(status);
}

function presentEvent(
  source: ActivityEventSource,
  activity: ReturnType<typeof useTranslations>,
  documentStatus: ReturnType<typeof useTranslations>,
): ActivityItem {
  const amount = source.amountCents == null ? undefined : formatMoneyFromCents(source.amountCents);

  return {
    id: source.id,
    kind: source.kind,
    title: activity(source.titleKey),
    entityType: source.entityType,
    entityId: source.entityId,
    amount,
    status: source.status,
    statusLabel: statusLabel(source.status, activity, documentStatus),
    actor: source.actor,
    timestamp: source.timestamp,
    timeLabel: source.timestamp.slice(11, 16),
    metadata: activity(source.metaKey, { amount: amount ?? "", id: source.entityId, ...source.metaValues }),
    href: source.href,
  };
}

function presentAttention(
  source: AttentionSource,
  activity: ReturnType<typeof useTranslations>,
): AttentionItem {
  const amount = source.amountCents == null ? undefined : formatMoneyFromCents(source.amountCents);

  return {
    id: source.id,
    kind: source.kind,
    title: activity(source.titleKey),
    amount,
    urgency: source.urgency,
    metadata: activity(source.metaKey, { amount: amount ?? "", id: source.entityId, ...source.metaValues }),
    href: source.href,
    entityType: source.entityType,
    entityId: source.entityId,
  };
}

function previewFromActivity(item: ActivityItem, activity: ReturnType<typeof useTranslations>): ActivityPreviewModel {
  const rows = [
    { label: activity("feed.preview.reference"), value: item.entityId },
    ...(item.amount ? [{ label: activity("feed.preview.amount"), value: item.amount }] : []),
    { label: activity("feed.preview.detail"), value: item.metadata },
  ];
  if (item.actor) rows.push({ label: activity("feed.preview.actor"), value: item.actor.name });

  return {
    id: item.id,
    title: item.title,
    status: item.status,
    statusLabel: item.statusLabel,
    rows,
    href: item.href,
    hrefLabel: item.href ? activity("feed.preview.open", { id: item.entityId }) : undefined,
  };
}

export function ActivityPanel({
  pending = false,
  showTip = true,
  sources = activityEvents,
  attentionSources = attentionFeed,
  className = "h-[360px] xl:h-full",
}: {
  className?: string;
  pending?: boolean;
  showTip?: boolean;
  sources?: ActivityEventSource[];
  attentionSources?: AttentionSource[];
}) {
  const activity = useTranslations("activity");
  const documentStatus = useTranslations("status");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [announcement, setAnnouncement] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [animateFilter, setAnimateFilter] = useState(false);
  const [preview, setPreview] = useState<ActivityPreviewModel | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const draftTimer = useRef<number | null>(null);

  const events = useMemo(
    () => sources.map((source) => presentEvent(source, activity, documentStatus)),
    [sources, activity, documentStatus],
  );
  const attention = useMemo(
    () => attentionSources.map((source) => presentAttention(source, activity)),
    [attentionSources, activity],
  );
  const visible = filterActivity(events, filter);
  const groups = groupActivity(visible);
  const reminder = events.find((item) => item.id === "act-suggestion-126");
  const overdue = attention.find((item) => item.id === "attn-overdue-126");

  useEffect(() => {
    return () => {
      if (draftTimer.current != null) window.clearTimeout(draftTimer.current);
    };
  }, []);

  function openDraft() {
    if (!reminder || preparing) return;
    const nextPreview: ActivityPreviewModel = {
      id: "draft-reminder",
      title: activity("feed.draftTitle"),
      body: activity("feed.assistantBody", { id: reminder.entityId, amount: reminder.amount ?? "" }),
      status: "suggestion",
      statusLabel: reminder.statusLabel,
      rows: [
        { label: activity("feed.preview.reference"), value: reminder.entityId },
        { label: activity("feed.preview.amount"), value: reminder.amount ?? "" },
        { label: activity("feed.preview.customer"), value: "Maison Laurent" },
      ],
      note: activity("feed.draftNote"),
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPreview(nextPreview);
      return;
    }
    setPreparing(true);
    draftTimer.current = window.setTimeout(() => {
      setPreparing(false);
      setPreview(nextPreview);
    }, 180);
  }

  function selectFilter(next: ActivityFilter, moveFocus = false) {
    setAnimateFilter(true);
    setFilter(next);
    const count = filterActivity(events, next).length;
    setAnnouncement(activity("feed.resultCount", { count }));
    if (moveFocus) {
      requestAnimationFrame(() => {
        document.getElementById(`activity-filter-${next}`)?.focus();
      });
    }
  }

  function onFilterKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = filters.indexOf(filter);
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = filters[(index + direction + filters.length) % filters.length];
    selectFilter(next, true);
  }

  const draftAmount = reminder?.amount ?? overdue?.amount ?? "";

  return (
    <section className={`activity-shell dashboard-card flex min-h-0 min-w-0 flex-col overflow-hidden ${className}`} id="activity">
      {pending ? (
        <ActivitySkeleton label={activity("feed.loading")} />
      ) : (
        <div className="activity-desk">
          <header className="activity-desk__header shrink-0 border-b border-[#edf1f6] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-[-0.01em] text-[#063586]">{activity("title")}</h2>
                <p className="mt-1 max-w-[62ch] text-sm leading-6 text-[#66758d]">{activity("feed.subtitle")}</p>
              </div>
              <button
                aria-label={activity("listFull.openAria")}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#044ce2]"
                type="button"
                onClick={() => setListOpen(true)}
              >
                {activity("feed.viewAll")}
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-4">
              <label className="activity-filter-select">
                <span className="sr-only">{activity("feed.filtersLabel")}</span>
                <select
                  className="h-10 w-full rounded-[12px] border border-[#dfe6f1] bg-[#f7f9fd] px-3 text-sm text-[#063586]"
                  value={filter}
                  onChange={(event) => selectFilter(event.target.value as ActivityFilter)}
                >
                  {filters.map((item) => (
                    <option key={item} value={item}>
                      {activity(`feed.filters.${item}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div
                aria-label={activity("feed.filtersLabel")}
                className="activity-filter-tabs gap-1 overflow-x-auto py-1"
                role="tablist"
                onKeyDown={onFilterKeyDown}
              >
                {filters.map((item) => {
                  const selected = filter === item;
                  return (
                    <button
                      aria-controls="activity-timeline"
                      aria-selected={selected}
                      className={`min-h-9 shrink-0 rounded-[10px] px-3 text-xs font-semibold transition-colors duration-150 ${
                        selected ? "bg-[#e7efff] text-[#044ce2]" : "bg-[#f6f8fc] text-[#69778e] hover:bg-[#e7efff] hover:text-[#044ce2]"
                      }`}
                      id={`activity-filter-${item}`}
                      key={item}
                      role="tab"
                      tabIndex={selected ? 0 : -1}
                      type="button"
                      onClick={() => selectFilter(item)}
                    >
                      {activity(`feed.filters.${item}`)}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="sr-only" aria-live="polite">
              {announcement}
            </p>
          </header>

          <div className="activity-desk__body">
          <NestedScrollChain
            className={`activity-desk__timeline dashboard-scroll ${animateFilter ? "activity-filter-swap" : ""}`}
            key={filter}
          >
            <ActivityTimeline
              countLabel={(count) => activity("feed.events", { count })}
              dayLabel={(day) => activity(`feed.days.${day}`)}
              emptyBody={activity(filter === "all" ? "feed.emptyBody" : "feed.emptyFilteredBody")}
              emptyTitle={activity(filter === "all" ? "feed.emptyTitle" : "feed.emptyFilteredTitle")}
              groups={groups}
              onOpen={(item) => setPreview(previewFromActivity(item, activity))}
            />
          </NestedScrollChain>

          <NestedScrollChain className="activity-rail dashboard-scroll">
            <AssistantSuggestion
              body={activity("feed.assistantBody", { id: "FAC20260126", amount: draftAmount })}
              countLabel={activity("feed.suggestions", { count: 1 })}
              preparing={preparing}
              primaryLabel={preparing ? activity("feed.preparing") : activity("feed.generate")}
              secondaryLabel={activity("feed.review")}
              suggestionTitle={activity("feed.assistantSuggestion")}
              title={activity("feed.assistant")}
              onPrimary={openDraft}
              onSecondary={() => {
                if (!overdue && !reminder) return;
                const sourceItem = reminder;
                setPreview({
                  id: "review-overdue",
                  title: activity("feed.attentionOverdue"),
                  status: "suggestion",
                  statusLabel: sourceItem?.statusLabel ?? activity("feed.status.suggestion"),
                  body: activity("feed.assistantBody", { id: "FAC20260126", amount: draftAmount }),
                  rows: [
                    { label: activity("feed.preview.reference"), value: "FAC20260126" },
                    { label: activity("feed.preview.amount"), value: draftAmount },
                    { label: activity("feed.preview.customer"), value: "Maison Laurent" },
                  ],
                });
              }}
            />
            <AttentionList
              caughtBody={activity("feed.caughtBody")}
              caughtTitle={activity("feed.caughtTitle")}
              countLabel={activity("feed.items", { count: attention.length })}
              items={attention}
              title={activity("feed.attention")}
              onOpen={(item) =>
                setPreview({
                  id: item.id,
                  title: item.title,
                  rows: [
                    { label: activity("feed.preview.reference"), value: item.entityId },
                    ...(item.amount ? [{ label: activity("feed.preview.amount"), value: item.amount }] : []),
                    { label: activity("feed.preview.detail"), value: item.metadata },
                  ],
                  href: item.href,
                  hrefLabel: item.href ? activity("feed.preview.open", { id: item.entityId }) : undefined,
                })
              }
            />
            {showTip && activityTip ? (
              <TipCard
                actionLabel={activity("feed.configure")}
                body={activity("feed.tipBody")}
                title={activity("feed.tips")}
                onAction={() =>
                  setPreview({
                    id: activityTip.id,
                    title: activity("feed.automationTitle"),
                    body: activity("feed.automationBody"),
                    rows: [],
                    note: activity("feed.draftNote"),
                  })
                }
              />
            ) : null}
          </NestedScrollChain>
          </div>
        </div>
      )}
      <ActivityListSheet
        events={events}
        open={listOpen}
        onClose={() => setListOpen(false)}
        onOpenItem={(item) => {
          setPreview(previewFromActivity(item, activity));
        }}
      />
      <ActivityPreview closeLabel={activity("feed.close")} model={preview} onClose={() => setPreview(null)} />
    </section>
  );
}
