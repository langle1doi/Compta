"use client";

import { Bot } from "lucide-react";
import { useTranslations } from "next-intl";

import { AssistantSuggestions } from "./assistant-suggestions";

export function AssistantWelcome({
  onSelectSuggestion,
}: {
  onSelectSuggestion: (prompt: string) => void;
}) {
  const t = useTranslations("assistant");

  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-start gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#eef5ff] text-[#145be7]">
          <Bot aria-hidden="true" className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-[#173156]">
            {t("welcome.title")}
          </h3>
          <p className="mt-1.5 max-w-[34ch] text-[13px] leading-5 text-[#7d8aa0]">
            {t("welcome.subtitle")}
          </p>
        </div>
      </div>
      <AssistantSuggestions onSelect={onSelectSuggestion} />
    </div>
  );
}
