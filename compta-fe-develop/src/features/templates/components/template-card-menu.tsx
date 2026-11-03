"use client";

import {
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Power,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import type { TemplateRecord } from "../model";

export type TemplateMenuAction =
  | "preview"
  | "edit"
  | "duplicate"
  | "set_default"
  | "toggle_status"
  | "delete";

export function TemplateCardMenu({
  template,
  canManage,
  onAction,
}: {
  template: TemplateRecord;
  canManage: boolean;
  onAction: (action: TemplateMenuAction) => void;
}) {
  const t = useTranslations("templates.menu");
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const allItems: {
    action: TemplateMenuAction;
    icon: typeof Eye;
    tone?: "danger";
    show: boolean;
  }[] = [
    { action: "preview", icon: Eye, show: true },
    { action: "edit", icon: Pencil, show: canManage },
    { action: "duplicate", icon: Copy, show: canManage },
    {
      action: "set_default",
      icon: Star,
      show: canManage && !template.isDefault,
    },
    { action: "toggle_status", icon: Power, show: canManage },
    { action: "delete", icon: Trash2, tone: "danger", show: canManage },
  ];
  const items = allItems.filter((item) => item.show);

  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = menu?.offsetWidth ?? 180;
      const menuHeight = menu?.offsetHeight ?? 220;
      const gap = 4;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      const openBelow = rect.bottom + gap + menuHeight <= window.innerHeight - 8;
      const top = openBelow
        ? rect.bottom + gap
        : Math.max(8, rect.top - gap - menuHeight);
      setMenuBox({ top, left });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("trigger")}
        className="action-motion soft-button grid h-8 w-8 place-items-center rounded-[8px] text-[#66758d]"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </button>
      {open
        ? createPortal(
            <ul
              ref={menuRef}
              className="fixed z-[80] min-w-[180px] overflow-hidden rounded-[12px] border border-[#e1e7f1] bg-white py-1 shadow-[0_12px_28px_rgba(29,43,68,0.14)]"
              id={menuId}
              role="menu"
              style={
                menuBox
                  ? { top: menuBox.top, left: menuBox.left }
                  : { top: -9999, left: -9999, visibility: "hidden" }
              }
            >
              {items.map((item) => (
                <li key={item.action}>
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#24334c] hover:bg-[#f4f8ff]",
                      item.tone === "danger" && "text-[#c9564f]",
                    )}
                    role="menuitem"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpen(false);
                      onAction(item.action);
                    }}
                  >
                    <item.icon
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 opacity-70"
                    />
                    {item.action === "toggle_status"
                      ? template.status === "active"
                        ? t("deactivate")
                        : t("activate")
                      : t(item.action)}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
