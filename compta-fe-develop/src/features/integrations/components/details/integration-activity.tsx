"use client";

import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { IntegrationActivity } from "../../model";

function formatWhen(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function IntegrationActivityPanel({
  items,
}: {
  items: IntegrationActivity[];
}) {
  const t = useTranslations("integrations");
  const locale = useLocale();

  if (items.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-[#dce6f3] px-4 py-8 text-center">
        <p className="text-sm font-semibold text-[#24334c]">
          {t("activity.emptyTitle")}
        </p>
        <p className="mt-1 text-[12px] text-[#7d8aa0]">
          {t("activity.emptyBody")}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          className="rounded-[14px] border border-[#e4ecf6] bg-[#f8fbff] px-3.5 py-3"
          key={item.id}
        >
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                item.tone === "success" && "bg-[#148455]",
                item.tone === "warning" && "bg-[#b76b0d]",
                item.tone === "info" && "bg-[#2468d8]",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-[#24334c]">
                  {t(item.titleKey)}
                </p>
                <time className="shrink-0 text-[11px] text-[#98a4b5]">
                  {formatWhen(item.at, locale)}
                </time>
              </div>
              {item.bodyKey ? (
                <p className="mt-1 text-[12px] leading-5 text-[#66758d]">
                  {t(item.bodyKey, item.bodyParams)}
                </p>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
