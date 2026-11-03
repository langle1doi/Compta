"use client";

import {
  Copy,
  Download,
  History,
  Mail,
  MoreHorizontal,
  PanelRightOpen,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { can } from "@/features/settings/can";
import type { PermissionId } from "@/features/settings/types";
import { cn } from "@/lib/utils";

import type { nextActionFor, QuoteRecord, QuoteStatus } from "../model";

export type QuoteMenuAction =
  | "open"
  | "duplicate"
  | "download"
  | "email"
  | "history"
  | "send"
  | "approve"
  | "followUp"
  | "convert"
  | "requestInvoice"
  | "delete";

export type QuoteCaps = {
  canCreate: boolean;
  canUpdate: boolean;
  canSend: boolean;
  canApprove: boolean;
  /** Turns an accepted quote into an invoice draft. */
  canConvert: boolean;
  /** Asks accounting to do it instead. */
  canRequestInvoice: boolean;
};

export function quoteCaps(permissions: readonly PermissionId[]): QuoteCaps {
  return {
    canCreate: can(permissions, "quote.create"),
    canUpdate: can(permissions, "quote.update"),
    canSend: can(permissions, "quote.send"),
    canApprove: can(permissions, "quote.approve"),
    canConvert: can(permissions, "invoice.create"),
    canRequestInvoice: can(permissions, "invoice.request"),
  };
}

/** The next action this user may run on a quote, or null when there is none for them. */
export function allowedQuoteAction(
  kind: ReturnType<typeof nextActionFor>["kind"],
  caps: QuoteCaps,
) {
  if (kind === "send") return caps.canSend ? ("send" as const) : null;
  if (kind === "approve") return caps.canApprove ? ("approve" as const) : null;
  if (kind === "followUp") return caps.canUpdate ? ("followUp" as const) : null;
  if (kind === "convert") {
    if (caps.canConvert) return "convert" as const;
    return caps.canRequestInvoice ? ("requestInvoice" as const) : null;
  }
  return null;
}

export function hasQuoteNextActions(caps: QuoteCaps) {
  return (
    caps.canSend || caps.canApprove || caps.canUpdate || caps.canConvert || caps.canRequestInvoice
  );
}

export function QuoteRowMenu({
  quote,
  caps,
  onAction,
}: {
  quote: QuoteRecord;
  caps: QuoteCaps;
  onAction: (action: QuoteMenuAction) => void;
}) {
  const t = useTranslations("register.menu");
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const items = menuItemsFor(quote.status, caps);

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

function menuItemsFor(status: QuoteStatus, caps: QuoteCaps) {
  const items: Array<{
    action: QuoteMenuAction;
    icon: typeof PanelRightOpen;
    tone?: "danger";
  }> = [
    { action: "open", icon: PanelRightOpen },
    ...(caps.canCreate ? [{ action: "duplicate" as const, icon: Copy }] : []),
    { action: "download", icon: Download },
    ...(caps.canSend ? [{ action: "email" as const, icon: Mail }] : []),
    { action: "history", icon: History },
  ];

  if (status === "draft" && caps.canSend) {
    items.splice(1, 0, { action: "send", icon: Mail });
  }
  if (status === "review" && caps.canApprove) {
    items.splice(1, 0, { action: "approve", icon: PanelRightOpen });
  }
  if (status === "sent" && caps.canUpdate) {
    items.splice(1, 0, { action: "followUp", icon: Mail });
  }
  const invoiceAction = status === "accepted" ? allowedQuoteAction("convert", caps) : null;
  if (invoiceAction) {
    items.splice(1, 0, { action: invoiceAction, icon: PanelRightOpen });
  }

  if (caps.canUpdate) {
    items.push({ action: "delete", icon: Trash2, tone: "danger" });
  }

  return items;
}
