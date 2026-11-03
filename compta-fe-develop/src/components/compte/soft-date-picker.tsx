"use client";

import { format, isValid, parse } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { dateMatchModifiers, DayPicker, type Matcher } from "react-day-picker";

import { todayIso } from "@/lib/iso-date";
import { cn } from "@/lib/utils";

import { useSoftFloatingMenu } from "./use-soft-floating-menu";

const MENU_WIDTH = 292;
const MENU_HEIGHT = 340;

function parseIso(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

function toIso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/**
 * Soft-UI date picker powered by react-day-picker.
 * Value is ISO `yyyy-MM-dd` (empty string when cleared).
 */
export function SoftDatePicker({
  label,
  value,
  onChange,
  className,
  triggerClassName,
  hideLabel = false,
  disabled = false,
  required = false,
  min,
  max,
  placeholder,
  displayFormat,
  clearable = true,
  menuZIndexClassName = "z-[110]",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  displayFormat?: string;
  clearable?: boolean;
  menuZIndexClassName?: string;
}) {
  const t = useTranslations("ui.datePicker");
  const localeCode = useLocale();
  const listId = useId();
  const selected = parseIso(value);
  const [month, setMonth] = useState<Date>(() => selected ?? new Date());
  const {
    open,
    menuBox,
    rootRef,
    triggerRef,
    menuRef,
    close,
    toggle,
  } = useSoftFloatingMenu({
    menuHeight: MENU_HEIGHT,
    minWidth: MENU_WIDTH,
  });

  const dateFnsLocale = localeCode.toLowerCase().startsWith("fr") ? fr : enUS;

  const display = selected
    ? format(selected, displayFormat ?? (localeCode.toLowerCase().startsWith("fr") ? "dd/MM/yyyy" : "MM/dd/yyyy"), {
        locale: dateFnsLocale,
      })
    : (placeholder ?? t("placeholder"));

  const disabledMatchers = useMemo(() => {
    const rules: Matcher[] = [];
    const minDate = min ? parseIso(min) : undefined;
    const maxDate = max ? parseIso(max) : undefined;
    if (minDate) rules.push({ before: minDate });
    if (maxDate) rules.push({ after: maxDate });
    return rules;
  }, [min, max]);
  const currentDay = parseIso(todayIso());
  const todayDisabled = Boolean(currentDay && dateMatchModifiers(currentDay, disabledMatchers));

  return (
    <div className={cn("relative min-w-0", className)} ref={rootRef}>
      {hideLabel ? null : (
        <span className="mb-1 block text-[11px] font-medium text-[#7d8aa0]">
          {label}
          {required ? <span className="text-[#8e2a26]"> *</span> : null}
        </span>
      )}
      <button
        ref={triggerRef}
        aria-controls={open ? listId : undefined}
        aria-disabled={disabled || undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        className={cn(
          "soft-input flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-[9px] !bg-white px-2.5 text-left text-xs font-semibold text-[#24334c] outline-none",
          !selected && "font-medium text-[#9aa8bc]",
          open && "ring-[3px] ring-[#044ce2]/25",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          triggerClassName,
        )}
        disabled={disabled}
        type="button"
        onClick={() => {
          if (disabled) return;
          if (!open) setMonth(selected ?? new Date());
          toggle();
        }}
      >
        <span className="min-w-0 truncate tabular-nums">{display}</span>
        <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#7d8aa0]" />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className={cn(
                "soft-date-picker fixed rounded-[14px] border border-[#e2eaf5] bg-white p-3 shadow-[0_1px_2px_rgba(55,65,81,0.05),0_12px_28px_rgba(29,43,68,0.14)]",
                menuZIndexClassName,
              )}
              id={listId}
              role="dialog"
              style={
                menuBox
                  ? {
                      top: menuBox.top,
                      left: menuBox.left,
                      width: menuBox.width,
                    }
                  : { top: -9999, left: -9999, visibility: "hidden" }
              }
            >
              <DayPicker
                animate
                className="soft-date-picker__calendar"
                disabled={disabledMatchers}
                locale={dateFnsLocale}
                mode="single"
                required={!clearable}
                month={month}
                selected={selected}
                onMonthChange={setMonth}
                onSelect={(date: Date | undefined) => {
                  if (date && dateMatchModifiers(date, disabledMatchers)) return;
                  onChange(date ? toIso(date) : "");
                  if (date) close();
                }}
                classNames={{
                  root: "w-full",
                  months: "w-full",
                  month: "w-full",
                  month_caption: "relative mb-2 flex h-9 items-center justify-center",
                  caption_label:
                    "text-[13px] font-semibold tracking-[-0.01em] text-[#24334c]",
                  nav: "absolute inset-x-0 top-0 flex items-center justify-between px-0.5",
                  button_previous:
                    "grid h-8 w-8 place-items-center rounded-[8px] text-[#516078] transition-colors hover:bg-[#f3f6fb]",
                  button_next:
                    "grid h-8 w-8 place-items-center rounded-[8px] text-[#516078] transition-colors hover:bg-[#f3f6fb]",
                  weekdays: "mb-1 grid grid-cols-7",
                  weekday:
                    "text-center text-[10px] font-semibold tracking-[0.04em] text-[#98a4b5]",
                  week: "mt-0.5 grid grid-cols-7",
                  day: "grid place-items-center p-0",
                  day_button:
                    "grid h-9 w-9 place-items-center rounded-[10px] text-[12px] font-semibold text-[#24334c] transition-colors hover:bg-[#eef4ff]",
                  selected:
                    "[&>button]:bg-[#145be7] [&>button]:text-white [&>button]:hover:bg-[#114fc9]",
                  today: "[&>button]:ring-1 [&>button]:ring-[#bfd6f8]",
                  outside: "[&>button]:text-[#b7c3d6]",
                  disabled:
                    "[&>button]:cursor-not-allowed [&>button]:text-[#c5ceda] [&>button]:hover:bg-transparent",
                  hidden: "invisible",
                }}
                components={{
                  Chevron: ({ orientation }) =>
                    orientation === "left" ? (
                      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    ),
                }}
              />
              <div className="mt-2 flex items-center justify-between border-t border-[#edf2f8] pt-2">
                {clearable ? <button
                  className="rounded-[8px] px-2 py-1 text-[12px] font-semibold text-[#145be7] transition-colors hover:bg-[#eef4ff]"
                  type="button"
                  onClick={() => {
                    onChange("");
                    close();
                  }}
                >
                  {t("clear")}
                </button> : <span />}
                <button
                  className="rounded-[8px] px-2 py-1 text-[12px] font-semibold text-[#145be7] transition-colors hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  disabled={todayDisabled}
                  type="button"
                  onClick={() => {
                    const today = todayIso();
                    const date = parseIso(today);
                    if (!date || dateMatchModifiers(date, disabledMatchers)) return;
                    onChange(today);
                    setMonth(date);
                    close();
                  }}
                >
                  {t("today")}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
