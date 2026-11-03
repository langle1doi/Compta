"use client";

import { useRef } from "react";
import { useNestedScrollChain } from "@/lib/use-nested-scroll-chain";

import {
  Bell,
  Calendar,
  Check,
  Clock,
  FileText,
  Landmark,
  MoreHorizontal,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DashboardScroll } from "@/components/dashboard/dashboard-scroll";
import { IconTile, StatusBadge } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";
import type { Tone } from "@/mocks/dashboard/types";

import { automationLabel } from "../label";
import type { AutomationDefinition } from "../model";
import { pauseAutomation, resumeAutomation } from "../store";

const cell = "min-w-0 overflow-hidden";

const typeIcon: Record<AutomationDefinition["type"], LucideIcon> = {
  bank_reconciliation: Landmark,
  payment_reminders: Bell,
  quote_follow_up: FileText,
};

const typeTone: Record<AutomationDefinition["type"], Tone> = {
  bank_reconciliation: "blue",
  payment_reminders: "orange",
  quote_follow_up: "purple",
};

const triggerIcon: Record<AutomationDefinition["type"], LucideIcon> = {
  bank_reconciliation: Clock,
  payment_reminders: Calendar,
  quote_follow_up: Zap,
};

function formatLastRun(iso: string | null, locale: string) {
  if (!iso) return { primary: "—", relativeKey: null as null };
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startToday.getTime() - startTarget.getTime()) / 86_400_000,
  );
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (dayDiff === 0) {
    return { primary: time, relativeKey: "list.lastRunToday" as const };
  }
  if (dayDiff === 1) {
    return { primary: time, relativeKey: "list.lastRunYesterday" as const };
  }
  return {
    primary: new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
    relativeKey: null as null,
  };
}

function isRunning(status: AutomationDefinition["status"]) {
  return status === "active";
}

function statusLabelKey(status: AutomationDefinition["status"]) {
  if (status === "active") return "status.active";
  if (status === "error") return "status.error";
  return "status.inactive";
}

export function AutomationList({
  items,
  selectedId,
  canManage,
  onSelect,
}: {
  items: AutomationDefinition[];
  selectedId: string | null;
  canManage: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("automation");
  const mobileScrollRef = useRef<HTMLUListElement>(null);
  useNestedScrollChain(mobileScrollRef);
  const locale = useLocale();

  if (items.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-[#24334c]">{t("empty.title")}</p>
        <p className="max-w-[36ch] text-[11px] leading-5 text-[#7d8aa0]">{t("empty.body")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden min-h-0 min-w-0 flex-1 flex-col md:flex">
        <DashboardScroll scrollClassName="overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-0 text-left text-[12px] xl:min-w-0">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col />
              <col style={{ width: "18%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: 108 }} />
            </colgroup>
            <thead className="dashboard-list__head">
              <tr>
                <th className={cell}>{t("list.columns.name")}</th>
                <th className={cell}>{t("list.columns.description")}</th>
                <th className={cell}>{t("list.columns.trigger")}</th>
                <th className={cell}>{t("list.columns.lastRun")}</th>
                <th className={cell}>{t("list.columns.status")}</th>
                <th className={`${cell} text-right`}>{t("list.columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const selected = item.id === selectedId;
                const Icon = typeIcon[item.type];
                const TriggerIcon = triggerIcon[item.type];
                const outcome = t(item.lastOutcomeKey, item.lastOutcomeParams);
                const lastRun = formatLastRun(item.lastRunAt, locale);
                const active = isRunning(item.status);

                return (
                  <tr
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "soft-row cursor-pointer border-b border-[var(--list-divider)] transition-colors",
                      selected ? "bg-[#eef4ff]" : "hover:bg-[var(--list-hover)]",
                    )}
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                  >
                    <td className={`relative ${cell} px-3.5 py-3 align-middle`}>
                      {selected ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[#044ce2]"
                        />
                      ) : null}
                      <div className="flex min-w-0 items-center gap-2.5">
                        <IconTile
                          className="shrink-0"
                          icon={Icon}
                          size="sm"
                          tone={typeTone[item.type]}
                        />
                        <div className="min-w-0">
                          <p className="dashboard-list__primary truncate">
                            {automationLabel(item, t)}
                          </p>
                          <span className="mt-1 inline-flex rounded-full bg-[#edf3fb] px-2 py-0.5 text-[10px] font-semibold text-[#516078]">
                            {t(`category.${item.category}`)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={`${cell} px-3 py-3 align-middle`}>
                      <p className="line-clamp-2 whitespace-normal text-[11px] leading-4 text-[#7d8aa0]">
                        {t(item.descriptionKey)}
                      </p>
                    </td>
                    <td className={`${cell} px-3 py-3 align-middle`}>
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-[#405069]">
                        <TriggerIcon
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-[#98a4b5]"
                        />
                        <span className="truncate">{t(item.triggerHelperKey)}</span>
                      </span>
                    </td>
                    <td className={`${cell} px-3 py-3 align-middle`}>
                      <p className="tabular-nums text-[11px] font-medium text-[#24334c]">
                        {lastRun.relativeKey
                          ? t(lastRun.relativeKey, { time: lastRun.primary })
                          : lastRun.primary}
                      </p>
                      <p
                        className="mt-0.5 truncate text-[10px] text-[#7d8aa0]"
                        title={outcome}
                      >
                        {outcome}
                      </p>
                    </td>
                    <td className={`${cell} px-3 py-3 align-middle`}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold",
                          active
                            ? "bg-[#e8f7ef] text-[#1f8f57]"
                            : item.status === "error"
                              ? "bg-[#fdeceb] text-[#c9564f]"
                              : "bg-[#eef1f6] text-[#6b778a]",
                        )}
                      >
                        {active ? (
                          <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#1f8f57] text-white">
                            <Check
                              aria-hidden="true"
                              className="h-2.5 w-2.5"
                              strokeWidth={3}
                            />
                          </span>
                        ) : (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              item.status === "error"
                                ? "bg-[#c9564f]"
                                : "bg-[#98a4b5]",
                            )}
                          />
                        )}
                        {t(statusLabelKey(item.status))}
                      </span>
                    </td>
                    <td className={`${cell} px-3 py-3 align-middle`}>
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {canManage ? (
                          <button
                            aria-checked={active}
                            aria-label={
                              active ? t("detail.pause") : t("detail.resume")
                            }
                            className={cn(
                              "relative h-5 w-9 rounded-full transition-colors",
                              active ? "bg-[#044ce2]" : "bg-[#d7deea]",
                            )}
                            role="switch"
                            type="button"
                            onClick={() => {
                              if (active) pauseAutomation(item.id);
                              else resumeAutomation(item.id);
                            }}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                                active && "translate-x-4",
                              )}
                            />
                          </button>
                        ) : null}
                        <button
                          aria-label={t("list.openActions")}
                          className="action-motion soft-button grid h-8 w-8 place-items-center rounded-[8px] text-[#516078]"
                          type="button"
                          onClick={() => onSelect(item.id)}
                        >
                          <MoreHorizontal
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DashboardScroll>
      </div>

      <ul ref={mobileScrollRef} className="dashboard-scroll--chain dashboard-scroll flex min-h-0 flex-1 flex-col overflow-y-auto md:hidden">
        {items.map((item) => {
          const selected = item.id === selectedId;
          const Icon = typeIcon[item.type];
          const outcome = t(item.lastOutcomeKey, item.lastOutcomeParams);
          const lastRun = formatLastRun(item.lastRunAt, locale);
          const active = isRunning(item.status);

          return (
            <li
              className="border-b border-[rgb(217_227_238/0.72)] last:border-b-0"
              key={item.id}
            >
              <button
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "soft-row relative flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition-colors",
                  selected ? "bg-[#eef4ff]" : "hover:bg-[var(--list-hover)]",
                )}
                type="button"
                onClick={() => onSelect(item.id)}
              >
                {selected ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[#044ce2]"
                  />
                ) : null}
                <IconTile
                  className="mt-0.5 shrink-0"
                  icon={Icon}
                  size="xs"
                  tone={typeTone[item.type]}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="dashboard-list__primary truncate">
                        {automationLabel(item, t)}
                      </p>
                      <span className="mt-1 inline-flex rounded-full bg-[#edf3fb] px-2 py-0.5 text-[10px] font-semibold text-[#516078]">
                        {t(`category.${item.category}`)}
                      </span>
                    </div>
                    <StatusBadge
                      className="shrink-0"
                      size="xs"
                      tone={
                        active
                          ? "green"
                          : item.status === "error"
                            ? "red"
                            : "slate"
                      }
                    >
                      {t(statusLabelKey(item.status))}
                    </StatusBadge>
                  </div>
                  <p className="dashboard-list__secondary mt-1.5 line-clamp-2 whitespace-normal">
                    {t(item.descriptionKey)}
                  </p>
                  <p className="dashboard-list__secondary mt-1.5">
                    {t(item.triggerHelperKey)}
                  </p>
                  <p className="mt-1 text-[10px] tabular-nums text-[#516078]">
                    {lastRun.relativeKey
                      ? t(lastRun.relativeKey, { time: lastRun.primary })
                      : lastRun.primary}
                    {" · "}
                    {outcome}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
