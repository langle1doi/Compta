"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { AssistantConversation } from "./types";

function formatWhen(iso: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AssistantHistory({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
}: {
  conversations: AssistantConversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const items = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const withMessages = items.filter((item) => item.messages.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[#edf1f7] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#173156]">
            {t("history.title")}
          </p>
          <p className="mt-0.5 text-[12px] text-[#7d8aa0]">
            {t("history.subtitle")}
          </p>
        </div>
        <button
          className="soft-button h-9 shrink-0 rounded-[10px] px-3 text-[12px] font-semibold text-[#405069]"
          type="button"
          onClick={onNew}
        >
          {t("actions.new")}
        </button>
      </div>

      <div className="assistant-body !pt-3">
        {withMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <MessageSquare
              aria-hidden="true"
              className="h-7 w-7 text-[#c3cedd]"
            />
            <p className="text-sm font-semibold text-[#24334c]">
              {t("history.emptyTitle")}
            </p>
            <p className="max-w-[32ch] text-[12px] leading-5 text-[#7d8aa0]">
              {t("history.emptyBody")}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {withMessages.map((item) => {
              const active = item.id === activeId;
              const count = item.messages.length;
              return (
                <li key={item.id}>
                  <div
                    className={cn(
                      "flex items-start gap-2 rounded-[14px] border px-3 py-2.5 transition-colors",
                      active
                        ? "border-[#bfd6f8] bg-[#f2f7ff]"
                        : "border-[#e4ecf6] bg-white hover:border-[#d5e2f4] hover:bg-[#f8fbff]",
                    )}
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      type="button"
                      onClick={() => onSelect(item.id)}
                    >
                      <p className="truncate text-[13px] font-semibold text-[#24334c]">
                        {item.title ?? t("history.untitled")}
                      </p>
                      <p className="mt-1 text-[11px] text-[#7d8aa0]">
                        {t("history.meta", {
                          count,
                          when: formatWhen(item.updatedAt, locale),
                        })}
                      </p>
                    </button>
                    <button
                      aria-label={t("history.delete")}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#9aa8bc] hover:bg-[#fff1ef] hover:text-[#b54841]"
                      type="button"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
