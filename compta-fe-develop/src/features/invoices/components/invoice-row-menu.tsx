"use client";

import {
  History,
  Mail,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { isInvoiceLocked, type InvoiceRecord, type nextInvoiceAction } from "../model";

export type InvoiceMenuAction = "open" | "edit" | "send" | "history" | "delete";

type InvoiceNextAction = ReturnType<typeof nextInvoiceAction>;

/** What the next-action button does for this user: without the right, it only opens the invoice. */
export function allowedInvoiceAction(
  next: InvoiceNextAction,
  caps: { canUpdate: boolean; canValidate: boolean; canFollowUp: boolean },
): InvoiceNextAction {
  if (next === "edit" && !caps.canUpdate) return "view";
  if (next === "validate" && !caps.canValidate) return "view";
  if (next === "followUp" && !caps.canFollowUp) return "view";
  return next;
}

export function InvoiceRowMenu({
  invoice,
  canUpdate,
  canSend,
  onAction,
}: {
  invoice: InvoiceRecord;
  canUpdate: boolean;
  canSend: boolean;
  onAction: (action: InvoiceMenuAction) => void;
}) {
  const t = useTranslations("invoices.menu");
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const locked = isInvoiceLocked(invoice);

  const items: Array<{ action: InvoiceMenuAction; icon: typeof PanelRightOpen; tone?: "danger" }> = [
    { action: "open", icon: PanelRightOpen },
    { action: "history", icon: History },
  ];
  if (!locked && canUpdate) {
    items.splice(1, 0, { action: "edit", icon: Pencil });
    items.push({ action: "delete", icon: Trash2, tone: "danger" });
  }
  if (locked && canSend) {
    items.splice(1, 0, { action: "send", icon: Mail });
  }

  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = menu?.offsetWidth ?? 180;
      const menuHeight = menu?.offsetHeight ?? 180;
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
                    <item.icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    {t(item.action)}
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
