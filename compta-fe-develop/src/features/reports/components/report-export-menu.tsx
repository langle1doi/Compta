"use client";

import { ChevronDown, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

const MENU_GAP = 6;
const MENU_EDGE = 8;
const MENU_WIDTH = 220;

type ExportItem = {
  key: string;
  onSelect: () => void;
};

export function ReportExportMenu({
  items,
  disabled = false,
}: {
  items: ExportItem[];
  disabled?: boolean;
}) {
  const t = useTranslations("reports.export");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setMenuBox(null);
  }, []);
  const dismissRoots = useMemo(() => [rootRef, menuRef], []);

  useOutsideDismiss({
    active: open,
    onDismiss: close,
    roots: dismissRoots,
  });

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const left = Math.min(
        Math.max(MENU_EDGE, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - MENU_EDGE,
      );
      setMenuBox({
        top: rect.bottom + MENU_GAP,
        left,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "action-motion soft-button inline-flex h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold text-[#405069]",
          open && "ring-1 ring-[#044ce2]/30",
          disabled && "cursor-not-allowed opacity-60",
        )}
        disabled={disabled}
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen((value) => !value);
        }}
      >
        <Download aria-hidden="true" className="h-3.5 w-3.5" />
        {t("menu")}
        <ChevronDown
          aria-hidden="true"
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[110] w-[220px] rounded-[12px] border border-[#e1e7f1] bg-white p-1.5 shadow-[0_12px_28px_rgba(29,43,68,0.14)]"
              role="menu"
              style={
                menuBox
                  ? { top: menuBox.top, left: menuBox.left }
                  : { top: -9999, left: -9999, visibility: "hidden" }
              }
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  className="flex w-full rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold text-[#405069] hover:bg-[#f5f8fd]"
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    item.onSelect();
                    close();
                  }}
                >
                  {t(`items.${item.key}`)}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
