"use client";

import { Bot, History, SquarePen, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PointerEvent as ReactPointerEvent } from "react";

import { cn } from "@/lib/utils";

export function AssistantHeader({
  onClose,
  onNewConversation,
  onToggleHistory,
  historyOpen,
  onPointerDownHandle,
}: {
  onClose: () => void;
  onNewConversation: () => void;
  onToggleHistory: () => void;
  historyOpen: boolean;
  onPointerDownHandle?: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const t = useTranslations("assistant");

  return (
    <header className="assistant-header" onPointerDown={onPointerDownHandle}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/15">
          <Bot aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">
            {t("title")}
          </p>
          <p className="truncate text-[11px] text-white/75">
            {historyOpen ? t("history.title") : t("status")}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          aria-label={t("actions.new")}
          className="grid h-9 w-9 place-items-center rounded-[10px] text-white/90 hover:bg-white/12"
          type="button"
          onClick={onNewConversation}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <SquarePen aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          aria-label={t("actions.history")}
          aria-pressed={historyOpen}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-[10px] text-white/90 hover:bg-white/12",
            historyOpen && "bg-white/16",
          )}
          type="button"
          onClick={onToggleHistory}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <History aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          aria-label={t("actions.close")}
          className="grid h-9 w-9 place-items-center rounded-[10px] text-white/90 hover:bg-white/12"
          type="button"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
