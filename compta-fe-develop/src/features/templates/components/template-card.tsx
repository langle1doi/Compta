"use client";

import { useLocale, useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";

import type { TemplateRecord } from "../model";
import { formatUpdatedAt, labelForUseCase, languageLabel } from "../labels";
import { TemplateCardThumbnail } from "./template-card-thumbnail";
import {
  TemplateCardMenu,
  type TemplateMenuAction,
} from "./template-card-menu";

export function TemplateCard({
  template,
  selected,
  canManage,
  onSelect,
  onAction,
}: {
  template: TemplateRecord;
  selected: boolean;
  canManage: boolean;
  onSelect: () => void;
  onAction: (action: TemplateMenuAction) => void;
}) {
  const t = useTranslations("templates");
  const locale = useLocale();

  return (
    <article
      className={cn(
        "group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-[14px] border bg-white transition-[border-color,box-shadow]",
        selected
          ? "border-[#2458d6] shadow-[0_0_0_1px_rgba(36,88,214,0.25),0_10px_24px_rgba(29,43,68,0.08)]"
          : "border-[#e1e7f1] hover:border-[#c9d6ea]",
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="relative h-[160px] overflow-hidden border-b border-[#e8eef7]">
        <TemplateCardThumbnail template={template} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#7d8aa0]">
              {labelForUseCase(template.useCase)}
            </p>
            <h3 className="truncate text-[14px] font-semibold text-[#173156]">
              {template.name}
            </h3>
          </div>
          <TemplateCardMenu
            canManage={canManage}
            template={template}
            onAction={onAction}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            size="xs"
            tone={template.status === "active" ? "green" : "slate"}
          >
            {template.status === "active"
              ? t("status.active")
              : t("status.inactive")}
          </StatusBadge>
          {template.isDefault ? (
            <StatusBadge size="xs" tone="blue">
              {t("badges.default")}
            </StatusBadge>
          ) : null}
          <span className="rounded-full bg-[#eef3f9] px-2 py-0.5 text-[10px] font-semibold text-[#516078]">
            {languageLabel(template.language)}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-[#7d8aa0]">
          <span className="truncate font-medium">{template.companyName}</span>
          <span className="shrink-0">
            {t("card.updated", {
              date: formatUpdatedAt(template.updatedAt, locale),
            })}
          </span>
        </div>
      </div>
    </article>
  );
}
