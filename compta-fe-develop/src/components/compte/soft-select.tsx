"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

export type SoftSelectOption = {
  value: string;
  label: string;
};

const OPEN_EVENT = "compte:soft-select-open";
const MENU_GAP = 4;
const MENU_EDGE = 8;
const MENU_MAX_CAP = 240;

/**
 * Soft-UI select — custom listbox (native <select> popups cannot be styled).
 * Opens downward by default; flips upward when space below is tight (e.g. pagination).
 * Closes on outside click / Escape / when another SoftSelect opens.
 */
export function SoftSelect({
  label,
  value,
  options,
  onChange,
  className,
  triggerClassName,
  hideLabel = false,
  disabled = false,
  activeTone = "soft",
  /** Above FormSheet (z-60–100) so the list stays clickable inside sheets. */
  menuZIndexClassName = "z-[110]",
}: {
  label: string;
  value: string;
  options: SoftSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  /** `solid` matches page-size menus (blue selected row). */
  activeTone?: "soft" | "solid";
  menuZIndexClassName?: string;
}) {
  const listId = useId();
  const instanceId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const dismissRoots = useMemo(() => [rootRef, menuRef], []);

  function openMenu() {
    setOpen(true);
    window.dispatchEvent(
      new CustomEvent(OPEN_EVENT, { detail: { id: instanceId } }),
    );
  }

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 120);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - MENU_GAP - MENU_EDGE);
      const spaceAbove = Math.max(0, rect.top - MENU_GAP - MENU_EDGE);
      const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(
        MENU_MAX_CAP,
        openUp ? Math.max(72, spaceAbove) : Math.max(72, spaceBelow),
      );
      const estimatedHeight = Math.min(maxHeight, options.length * 36 + 8);
      const top = openUp
        ? Math.max(MENU_EDGE, rect.top - MENU_GAP - estimatedHeight)
        : rect.bottom + MENU_GAP;
      const maxLeft = Math.max(MENU_EDGE, window.innerWidth - width - MENU_EDGE);
      setMenuBox({
        top,
        left: Math.min(Math.max(MENU_EDGE, rect.left), maxLeft),
        width,
        maxHeight,
      });
    }

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, options.length]);

  useOutsideDismiss({
    active: open,
    onDismiss: close,
    roots: dismissRoots,
  });

  useLayoutEffect(() => {
    if (!open) return;

    function onOtherOpen(event: Event) {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== instanceId) close();
    }

    window.addEventListener(OPEN_EVENT, onOtherOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOtherOpen);
  }, [open, instanceId, close]);

  return (
    <div
      className={cn("relative min-w-0", className)}
      data-soft-select-root={instanceId}
      ref={rootRef}
    >
      {hideLabel ? null : (
        <span className="mb-1 block text-[11px] font-medium text-[#7d8aa0]">{label}</span>
      )}
      <button
        ref={triggerRef}
        aria-controls={open ? listId : undefined}
        aria-disabled={disabled || undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={cn(
          "soft-input flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-[9px] !bg-white px-2.5 text-left text-xs font-semibold text-[#24334c] outline-none",
          open && "ring-[3px] ring-[#044ce2]/25",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          triggerClassName,
        )}
        disabled={disabled}
        type="button"
        onClick={() => {
          if (disabled) return;
          if (open) {
            close();
            return;
          }
          openMenu();
        }}
      >
        <span className="min-w-0 truncate">{selected?.label ?? value}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[#7d8aa0] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open
        ? createPortal(
            <ul
              ref={menuRef}
              aria-label={label}
              className={cn(
                "soft-select-scroll fixed overflow-y-auto overscroll-contain rounded-[10px] border border-[#e2eaf5] bg-white py-1 shadow-[0_1px_2px_rgba(55,65,81,0.05),0_12px_28px_rgba(29,43,68,0.14)]",
                menuZIndexClassName,
              )}
              data-soft-select-list={instanceId}
              id={listId}
              role="listbox"
              style={
                menuBox
                  ? {
                      top: menuBox.top,
                      left: menuBox.left,
                      width: menuBox.width,
                      maxHeight: menuBox.maxHeight,
                    }
                  : { top: -9999, left: -9999, visibility: "hidden" }
              }
            >
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <li key={option.value} role="none">
                    <button
                      aria-selected={active}
                      className={cn(
                        "flex min-h-9 w-full items-center justify-between gap-2 px-2.5 text-left text-xs font-medium",
                        active
                          ? activeTone === "solid"
                            ? "bg-[#145be7] text-white"
                            : "bg-[#eef4ff] text-[#044ce2]"
                          : "text-[#24334c] hover:bg-[#f5f8fd]",
                      )}
                      role="option"
                      type="button"
                      onMouseDown={(event) => {
                        // Keep focus on trigger; select on click.
                        event.preventDefault();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        onChange(option.value);
                        close();
                      }}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      {active && activeTone !== "solid" ? (
                        <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
