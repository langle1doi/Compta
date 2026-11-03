"use client";

import {
  CheckCircle2,
  CircleAlert,
  CircleMinus,
  CircleX,
  FileText,
  Landmark,
  Mail,
  ReceiptText,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type {
  AutomationRun,
  AutomationRunActivityAction,
  AutomationRunActivityStatus,
  AutomationRunActivityType,
} from "../model";
import { activitiesForRun } from "../run-activity";

const statusDot: Record<AutomationRunActivityStatus, string> = {
  success: "bg-[#1f8f57] text-white",
  info: "bg-[#044ce2] text-white",
  warning: "bg-[#d97706] text-white",
  error: "bg-[#c9564f] text-white",
  skip: "bg-[#98a4b5] text-white",
};

function iconFor(
  type: AutomationRunActivityType,
  status: AutomationRunActivityStatus,
): LucideIcon {
  if (status === "error" || type === "error") return CircleX;
  if (status === "warning" || type === "review") return CircleAlert;
  if (status === "skip" || type === "skip") return CircleMinus;
  if (type === "email" || type === "notification") return Mail;
  if (type === "payment") return WalletCards;
  if (type === "invoice") return ReceiptText;
  if (type === "quote") return FileText;
  if (type === "approval") return CheckCircle2;
  if (type === "system") return Landmark;
  return CheckCircle2;
}

export function RunActivityTimeline({
  run,
  onAction,
  compact = false,
}: {
  run: AutomationRun | null;
  onAction?: (kind: AutomationRunActivityAction) => void;
  compact?: boolean;
}) {
  const t = useTranslations("automation");
  const items = activitiesForRun(run);

  if (!run) {
    return (
      <p className="px-1 py-4 text-center text-[11px] text-[#98a4b5]">
        {t("runActivity.empty")}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#edf2f8] px-3 py-5 text-center">
        <p className="text-[12px] font-semibold text-[#24334c]">{t("runActivity.emptyTitle")}</p>
        <p className="mt-1 text-[11px] text-[#7d8aa0]">{t("runActivity.emptyBody")}</p>
      </div>
    );
  }

  return (
    <ol className={cn("relative", compact ? "space-y-2.5" : "space-y-3")}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-2 bottom-2 left-[11px] w-px bg-[#e1e7f1]"
      />
      {items.map((item) => {
        const Icon = iconFor(item.type, item.status);
        return (
          <li className="relative flex gap-2.5" key={item.id}>
            <span
              className={cn(
                "relative z-[1] mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full",
                statusDot[item.status],
              )}
            >
              <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <time className="shrink-0 text-[10px] font-semibold tabular-nums text-[#98a4b5]">
                  {item.at}
                </time>
                <p className="text-[11px] font-semibold text-[#24334c]">
                  {t(item.titleKey, item.titleParams)}
                </p>
              </div>
              {item.descriptionKey ? (
                <p className="mt-0.5 text-[10px] leading-4 text-[#7d8aa0]">
                  {t(item.descriptionKey, item.descriptionParams)}
                </p>
              ) : null}
              {item.entityLabel ? (
                <p className="mt-0.5 text-[10px] font-medium text-[#516078]">
                  {item.entityLabel}
                </p>
              ) : null}
              {item.actor ? (
                <p className="mt-0.5 text-[10px] text-[#98a4b5]">
                  {t("runActivity.meta.by", { actor: item.actor })}
                </p>
              ) : null}
              {item.meta && item.meta.length > 0 ? (
                <dl className="mt-1 space-y-0.5">
                  {item.meta.map((row) => (
                    <div className="flex flex-wrap gap-x-1.5 text-[10px]" key={row.labelKey}>
                      <dt className="text-[#98a4b5]">{t(row.labelKey)}</dt>
                      <dd className="font-medium text-[#405069]">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {item.action && onAction ? (
                <button
                  className="action-motion soft-primary mt-1.5 h-7 rounded-[8px] px-2.5 text-[10px] font-semibold text-white"
                  type="button"
                  onClick={() => onAction(item.action!.kind)}
                >
                  {t(item.action.labelKey, { count: item.action.count ?? 0 })}
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
