"use client";

import { Bell, Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useVisibleActionItems } from "@/components/dashboard/attention-gate";
import { cn } from "@/lib/utils";
import { actionItems } from "@/mocks/dashboard";
import type { ActionItem } from "@/mocks/dashboard/types";

type Tab = "all" | "unread";

type RelativeTime =
  | { unit: "minutes"; count: number }
  | { unit: "hours"; count: number }
  | { unit: "days"; count: number }
  | { unit: "weeks"; count: number };

type NotificationItem = ActionItem & {
  unread: boolean;
  time: RelativeTime;
  showActions: boolean;
};

const TIME_BY_ID: Record<string, RelativeTime> = {
  "actn-01": { unit: "hours", count: 2 },
  "actn-02": { unit: "hours", count: 5 },
  "actn-03": { unit: "days", count: 1 },
  "actn-04": { unit: "days", count: 2 },
  "actn-05": { unit: "days", count: 3 },
  "actn-06": { unit: "days", count: 4 },
  "actn-07": { unit: "days", count: 6 },
  "actn-08": { unit: "weeks", count: 1 },
  "actn-09": { unit: "weeks", count: 1 },
  "actn-10": { unit: "weeks", count: 2 },
};

function buildNotifications(items: ActionItem[]): NotificationItem[] {
  return items.slice(0, 8).map((item, index) => ({
    ...item,
    unread: index < 4,
    time: TIME_BY_ID[item.id] ?? { unit: "days", count: 1 },
    showActions: index < 2,
  }));
}

function emphasizeTitle(
  text: string,
  values: Record<string, string | number>,
) {
  const highlight =
    values.id != null
      ? String(values.id)
      : values.customer != null
        ? String(values.customer)
        : values.count != null
          ? String(values.count)
          : null;

  if (!highlight || !text.includes(highlight)) {
    return text;
  }

  const [before, ...rest] = text.split(highlight);
  const after = rest.join(highlight);

  return (
    <>
      {before}
      <strong className="font-semibold text-[#152a45]">{highlight}</strong>
      {after}
    </>
  );
}

export function HeaderNotifications({ label }: { label: string }) {
  const t = useTranslations();
  const panel = useTranslations("header.notificationsPanel");
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [allItems, setItems] = useState(() => buildNotifications(actionItems));
  const items = useVisibleActionItems(allItems);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const unreadCount = useMemo(
    () => items.filter((item) => item.unread).length,
    [items],
  );

  const visibleItems = useMemo(() => {
    if (tab === "unread") return items.filter((item) => item.unread);
    return items;
  }, [items, tab]);

  const newItems = visibleItems.filter((item) => item.unread);
  const earlierItems = visibleItems.filter((item) => !item.unread);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setOptionsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setOptionsOpen(false);
      }
    };

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const formatTime = (time: RelativeTime) => {
    if (time.unit === "minutes") return panel("timeMinutes", { count: time.count });
    if (time.unit === "hours") return panel("timeHours", { count: time.count });
    if (time.unit === "days") return panel("timeDays", { count: time.count });
    return panel("timeWeeks", { count: time.count });
  };

  const markAllRead = () => {
    setItems((current) => current.map((item) => ({ ...item, unread: false })));
    setOptionsOpen(false);
  };

  const markRead = (id: string) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    );
  };

  const renderItem = (item: NotificationItem) => {
    const title = t(item.titleKey, item.titleValues);
    const meta = t(item.metaKey, item.metaValues);

    return (
      <div
        className={cn(
          "group flex w-full items-start gap-2.5 rounded-[12px] px-2.5 py-2.5 transition-colors duration-150",
          item.unread ? "bg-[#edf3ff]/70 hover:bg-[#e5eeff]" : "hover:bg-[#f3f7fc]",
        )}
        key={item.id}
        role="menuitem"
      >
        <div className="min-w-0 flex-1">
          <button
            className="w-full min-w-0 text-left"
            onClick={() => markRead(item.id)}
            type="button"
          >
            <span className="block whitespace-normal break-words text-[13px] leading-5 text-[#3d4f68]">
              {emphasizeTitle(title, item.titleValues)}
            </span>
            <span className="mt-0.5 block whitespace-normal break-words text-[12px] leading-4 text-[#7a899e]">
              {meta}
            </span>
            <span
              className={cn(
                "mt-1 block text-[12px] font-semibold",
                item.unread ? "text-[#245de9]" : "text-[#8a97ab]",
              )}
            >
              {formatTime(item.time)}
            </span>
          </button>

          {item.showActions ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                className="inline-flex h-8 items-center justify-center rounded-[8px] bg-[#245de9] px-3 text-[12px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset]"
                onClick={() => markRead(item.id)}
                type="button"
              >
                {t(item.actionKey)}
              </button>
              <button
                className="inline-flex h-8 items-center justify-center rounded-[8px] bg-[#e8eef6] px-3 text-[12px] font-semibold text-[#3d4f68] hover:bg-[#dde6f1]"
                onClick={() => markRead(item.id)}
                type="button"
              >
                {panel("dismiss")}
              </button>
            </div>
          ) : null}
        </div>

        {item.unread ? (
          <span
            aria-hidden="true"
            className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#245de9]"
          />
        ) : (
          <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0" />
        )}
      </div>
    );
  };

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="action-motion soft-button relative grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[#506078] hover:text-[#044ce2]"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
          setOptionsOpen(false);
        }}
        type="button"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="pulse-dot absolute top-2 right-2 h-2 w-2 rounded-full bg-[#e9764f] ring-2 ring-white"
          />
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute top-[calc(100%+8px)] right-0 z-50 flex w-[min(22.75rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[16px] border border-[#dbe5f2] bg-white shadow-[0_18px_48px_rgba(48,74,110,0.18),0_2px_8px_rgba(48,74,110,0.08)]"
          id={menuId}
          role="menu"
        >
          <div className="shrink-0 border-b border-[#edf2f8] px-3.5 pt-3.5 pb-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[22px] leading-7 font-bold tracking-[-0.03em] text-[#152a45]">
                {panel("title")}
              </h2>
              <div className="relative">
                <button
                  aria-expanded={optionsOpen}
                  aria-label={panel("options")}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#5b6b82] transition-colors hover:bg-[#f0f4fa] hover:text-[#152a45]"
                  onClick={() => setOptionsOpen((value) => !value)}
                  type="button"
                >
                  <Ellipsis aria-hidden="true" className="h-5 w-5" />
                </button>
                {optionsOpen ? (
                  <div className="absolute top-[calc(100%+4px)] right-0 z-10 min-w-[11.5rem] overflow-hidden rounded-[10px] border border-[#e1eaf4] bg-white py-1 shadow-[0_10px_28px_rgba(48,74,110,0.16)]">
                    <button
                      className="flex w-full px-3 py-2 text-left text-[13px] font-medium text-[#24334c] hover:bg-[#f3f7fc]"
                      onClick={markAllRead}
                      type="button"
                    >
                      {panel("markAllRead")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                aria-pressed={tab === "all"}
                className={cn(
                  "h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                  tab === "all"
                    ? "bg-[#245de9] text-white"
                    : "bg-transparent text-[#3d4f68] hover:bg-[#f0f4fa]",
                )}
                onClick={() => setTab("all")}
                type="button"
              >
                {panel("tabAll")}
              </button>
              <button
                aria-pressed={tab === "unread"}
                className={cn(
                  "h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                  tab === "unread"
                    ? "bg-[#245de9] text-white"
                    : "bg-transparent text-[#3d4f68] hover:bg-[#f0f4fa]",
                )}
                onClick={() => setTab("unread")}
                type="button"
              >
                {panel("tabUnread")}
              </button>
            </div>
          </div>

          <div className="notifications-scroll max-h-[min(70vh,28rem)] min-h-0 overflow-y-auto overscroll-contain px-1.5 py-1.5">
            {visibleItems.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[#7a899e]">
                {tab === "unread" ? panel("emptyUnread") : panel("emptyAll")}
              </p>
            ) : (
              <>
                {newItems.length > 0 ? (
                  <section className="mb-1">
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                      <p className="text-[15px] font-semibold text-[#152a45]">
                        {panel("new")}
                      </p>
                      <button
                        className="text-[13px] font-semibold text-[#245de9] hover:underline"
                        onClick={() => setOpen(false)}
                        type="button"
                      >
                        {panel("seeAll")}
                      </button>
                    </div>
                    <div className="space-y-0.5">{newItems.map(renderItem)}</div>
                  </section>
                ) : null}

                {earlierItems.length > 0 ? (
                  <section>
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                      <p className="text-[15px] font-semibold text-[#152a45]">
                        {panel("earlier")}
                      </p>
                      {newItems.length === 0 ? (
                        <button
                          className="text-[13px] font-semibold text-[#245de9] hover:underline"
                          onClick={() => setOpen(false)}
                          type="button"
                        >
                          {panel("seeAll")}
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-0.5">{earlierItems.map(renderItem)}</div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
