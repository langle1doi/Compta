"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { IntegrationLogo } from "../logo-registry";
import type {
  IntegrationDefinition,
  IntegrationDisplayStatus,
} from "../model";
import { IntegrationStatusBadge } from "./integration-status-badge";

export function IntegrationCard({
  definition,
  status,
  selected,
  canManage,
  primaryLabel,
  onSelect,
  onPrimary,
}: {
  definition: IntegrationDefinition;
  status: IntegrationDisplayStatus;
  selected: boolean;
  canManage: boolean;
  primaryLabel: string;
  onSelect: () => void;
  onPrimary: () => void;
}) {
  const t = useTranslations("integrations");

  return (
    <article
      className={cn(
        "integration-card flex min-h-[166px] min-w-0 flex-col rounded-[14px] border border-[#e4ecf6] bg-[#f8fbff] p-3.5 transition-[border-color,box-shadow,background-color] duration-[180ms] ease-out",
        "hover:border-[#cfdff3] hover:bg-[#f3f8ff]",
        selected &&
          "border-[#4f8df7] bg-[linear-gradient(180deg,#f3f8ff_0%,#f8fbff_100%)] shadow-[0_0_0_2px_rgba(59,130,246,.08)]",
      )}
    >
      <button
        aria-pressed={selected}
        className="flex w-full min-w-0 items-start gap-3 text-left"
        type="button"
        onClick={onSelect}
      >
        <IntegrationLogo logoKey={definition.logoKey} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#173156]">
                {t(definition.nameKey)}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-[#7d8aa0]">
                {t(`categories.${definition.category}`)}
              </p>
            </div>
            <IntegrationStatusBadge status={status} />
          </div>
        </div>
      </button>

      <dl className="mt-3 space-y-2.5 text-[13px]">
        <div className="min-w-0">
          <dt className="text-[12px] text-[#7d8aa0]">{t("detail.about")}</dt>
          <dd className="mt-0.5 line-clamp-2 font-medium leading-5 text-[#405069]">
            {t(definition.descriptionKey)}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        {canManage ? (
          <button
            className={cn(
              "inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-[10px] px-3 text-[12px] font-semibold transition-colors",
              status === "coming_soon"
                ? "cursor-not-allowed bg-[#eef2f7] text-[#778397]"
                : status === "connected" || status === "attention"
                  ? "border border-[#d5e2f4] bg-white text-[#405069] hover:bg-white/90"
                  : "soft-primary action-motion text-white",
            )}
            disabled={status === "coming_soon"}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPrimary();
            }}
          >
            {primaryLabel}
          </button>
        ) : null}
        <button
          aria-label={t("card.more")}
          className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[#dce6f3] bg-white text-[#66758d] hover:bg-white/90"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
