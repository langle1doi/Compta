"use client";

import { Clock } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { useSoftFloatingMenu } from "./use-soft-floating-menu";

const ITEM_H = 32;
const VISIBLE = 5;
const MENU_HEIGHT = 220;
const MENU_MIN_WIDTH = 220;

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  i.toString().padStart(2, "0"),
);

function parseTime(value: string) {
  const [h = "08", m = "00"] = value.split(":");
  const hour = HOURS.includes(h) ? h : "08";
  const minute = MINUTES.includes(m) ? m : "00";
  return { hour, minute };
}

function formatDisplay(value: string, locale: string) {
  const { hour, minute } = parseTime(value);
  const date = new Date(Date.UTC(2026, 0, 1, Number(hour), Number(minute)));
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function ScrollColumn({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | null>(null);
  const ignoreScrollRef = useRef(true);
  const pad = Math.floor(VISIBLE / 2) * ITEM_H;

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    ignoreScrollRef.current = true;
    const index = Math.max(0, values.indexOf(value));
    el.scrollTop = index * ITEM_H;
    const frame = window.requestAnimationFrame(() => {
      ignoreScrollRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [value, values]);

  function settle() {
    if (ignoreScrollRef.current) return;
    const el = listRef.current;
    if (!el) return;
    const index = Math.min(
      values.length - 1,
      Math.max(0, Math.round(el.scrollTop / ITEM_H)),
    );
    const next = values[index];
    if (next && next !== value) onChange(next);
    ignoreScrollRef.current = true;
    el.scrollTo({ top: index * ITEM_H, behavior: "smooth" });
    window.setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 120);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <p className="mb-1 text-center text-[10px] font-semibold tracking-wide text-[#98a4b5] uppercase">
        {label}
      </p>
      <div className="relative h-[160px] overflow-hidden rounded-[9px] border border-[#e8eef6] bg-[#fbfcfe]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 top-1/2 z-[1] h-8 -translate-y-1/2 rounded-[7px] border border-[#c9d9ff] bg-[#eef4ff]/70"
        />
        <div
          ref={listRef}
          aria-label={label}
          className="soft-select-scroll h-full overflow-y-auto overscroll-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="listbox"
          onScroll={() => {
            if (ignoreScrollRef.current) return;
            if (settleRef.current) window.clearTimeout(settleRef.current);
            settleRef.current = window.setTimeout(settle, 80);
          }}
        >
          <div style={{ height: pad }} />
          {values.map((item) => {
            const active = item === value;
            return (
              <button
                aria-selected={active}
                className={cn(
                  "flex h-8 w-full items-center justify-center text-xs font-semibold tabular-nums transition-colors",
                  active ? "text-[#044ce2]" : "text-[#7d8aa0] hover:text-[#405069]",
                )}
                key={item}
                role="option"
                type="button"
                onClick={() => onChange(item)}
              >
                {item}
              </button>
            );
          })}
          <div style={{ height: pad }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Soft-UI time picker — scroll columns for hour and minute.
 * Matches SoftSelect open/close + portal behavior for use inside Sheets.
 */
export function SoftTimePicker({
  label,
  value,
  onChange,
  locale,
  disabled = false,
  hideLabel = false,
  hourLabel = "Hour",
  minuteLabel = "Minute",
  className,
  triggerClassName,
  menuZIndexClassName = "z-[110]",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: string;
  disabled?: boolean;
  hideLabel?: boolean;
  hourLabel?: string;
  minuteLabel?: string;
  className?: string;
  triggerClassName?: string;
  menuZIndexClassName?: string;
}) {
  const listId = useId();
  const {
    open,
    menuBox,
    rootRef,
    triggerRef,
    menuRef,
    toggle,
  } = useSoftFloatingMenu({
    menuHeight: MENU_HEIGHT,
    minWidth: MENU_MIN_WIDTH,
  });
  const parsed = parseTime(value);

  function setHour(hour: string) {
    onChange(`${hour}:${parsed.minute}`);
  }

  function setMinute(minute: string) {
    onChange(`${parsed.hour}:${minute}`);
  }

  return (
    <div className={cn("relative min-w-0", className)} ref={rootRef}>
      {hideLabel ? null : (
        <span className="mb-1 block text-[11px] font-medium text-[#7d8aa0]">
          {label}
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
          open && "ring-1 ring-[#044ce2]/30",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          triggerClassName,
        )}
        disabled={disabled}
        type="button"
        onClick={() => {
          if (disabled) return;
          toggle();
        }}
      >
        <span className="min-w-0 truncate tabular-nums">
          {formatDisplay(value, locale)}
        </span>
        <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#7d8aa0]" />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className={cn(
                "fixed rounded-[12px] border border-[#e2eaf5] bg-white p-2.5 shadow-[0_12px_28px_rgba(29,43,68,0.14)]",
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
              <div className="flex gap-2">
                <ScrollColumn
                  label={hourLabel}
                  value={parsed.hour}
                  values={HOURS}
                  onChange={setHour}
                />
                <ScrollColumn
                  label={minuteLabel}
                  value={parsed.minute}
                  values={MINUTES}
                  onChange={setMinute}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
