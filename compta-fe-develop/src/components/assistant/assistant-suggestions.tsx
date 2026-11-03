"use client";

import {
  ChevronRight,
  CircleDollarSign,
  FileWarning,
  LineChart,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";

import type { AssistantSuggestionId } from "./types";

const SUGGESTIONS: {
  id: AssistantSuggestionId;
  icon: LucideIcon;
}[] = [
  { id: "overdueInvoices", icon: FileWarning },
  { id: "quotePipeline", icon: LineChart },
  { id: "customersOwe", icon: CircleDollarSign },
  { id: "whatChanged", icon: Sparkles },
];

export function AssistantSuggestions({
  onSelect,
}: {
  onSelect: (prompt: string) => void;
}) {
  const t = useTranslations("assistant");

  return (
    <div className="mt-5 grid gap-2.5">
      {SUGGESTIONS.map((item) => {
        const Icon = item.icon;
        const label = t(`suggestions.${item.id}`);
        return (
          <button
            className="group flex min-h-[68px] w-full items-center gap-3 rounded-[14px] border border-[#dde7f4] bg-white px-3.5 py-3.5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.035)] transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-[#bfd6f8] hover:bg-[#f8fbff]"
            key={item.id}
            type="button"
            onClick={() => onSelect(label)}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-[#eef5ff] text-[#145be7]">
              <Icon aria-hidden="true" className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-[#24334c]">
              {label}
            </span>
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-[#9aa8bc] transition-colors group-hover:text-[#145be7]"
            />
          </button>
        );
      })}
    </div>
  );
}
