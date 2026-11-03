"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  useSidebarOptional,
} from "@/components/shell/sidebar";
import { cn } from "@/lib/utils";

const EXIT_MS = 200;
/** Collapsed rail uses `ml-2` (8px) outside the animated width. */
const SIDEBAR_COLLAPSED_GUTTER = 8;

/**
 * Canonical COMPTE data-entry surface: full-height sheet from the right.
 * Portaled to document.body so it stacks above app shell chrome (topbar/sidebar).
 * Prefer ConfirmDialog for alerts.
 */
export function FormSheet({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  widthClassName = "sm:max-w-[480px]",
  closeLabel = "Close",
  zIndexClassName = "z-[100]",
  showHeader = true,
  contentClassName,
  /** Desktop: panel width = viewport − sidebar (no gap between rail and sheet). */
  fillBesideSidebar = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  closeLabel?: string;
  zIndexClassName?: string;
  /** When false, chrome header is omitted — detail panels own title + close. */
  showHeader?: boolean;
  contentClassName?: string;
  fillBesideSidebar?: boolean;
}) {
  const sidebar = useSidebarOptional();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const sidebarWidth =
    sidebar?.isDesktop
      ? sidebar.open
        ? SIDEBAR_EXPANDED_WIDTH
        : SIDEBAR_COLLAPSED_WIDTH + SIDEBAR_COLLAPSED_GUTTER
      : 0;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (mounted && open && (!visible || exiting)) {
    setVisible(true);
    setExiting(false);
  }

  if (mounted && !open && visible && !exiting) {
    setExiting(true);
  }

  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [exiting]);

  useEffect(() => {
    if (!visible || exiting) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [visible, exiting, onClose]);

  if (!mounted || !visible) return null;

  const fillDesktop = fillBesideSidebar && sidebarWidth > 0;

  return createPortal(
    <div className={cn("fixed inset-0 flex justify-end", zIndexClassName)}>
      <button
        aria-label={closeLabel}
        className={cn(
          "absolute inset-0 cursor-default bg-[rgb(55_65_81/0.8)] backdrop-blur-[12px]",
          exiting ? "form-sheet-backdrop-exit" : "form-sheet-backdrop-enter",
        )}
        type="button"
        onClick={onClose}
      />
      <aside
        aria-labelledby="compte-form-sheet-title"
        aria-modal="true"
        className={cn(
          "relative z-10 flex h-full w-full flex-col bg-white shadow-[-18px_0_48px_rgb(29_43_68/0.14)]",
          "max-sm:fixed max-sm:inset-0",
          exiting ? "form-sheet-panel-exit" : "form-sheet-panel-enter",
          fillDesktop ? "max-w-none" : widthClassName,
        )}
        role="dialog"
        style={
          fillDesktop
            ? { width: `calc(100% - ${sidebarWidth}px)`, maxWidth: "none" }
            : undefined
        }
      >
        {showHeader ? (
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e8eef6] px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <h2
                className="text-lg font-semibold tracking-[-0.02em] text-[#063586]"
                id="compte-form-sheet-title"
              >
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm leading-5 text-[#728097]">{description}</p>
              ) : null}
            </div>
            <button
              aria-label={closeLabel}
              className="soft-button grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[#506078]"
              type="button"
              onClick={onClose}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </header>
        ) : (
          <h2 className="sr-only" id="compte-form-sheet-title">
            {title}
          </h2>
        )}
        <div
          className={cn(
            "dashboard-scroll min-h-0 flex-1 overflow-y-auto",
            contentClassName ?? "px-4 py-4 sm:px-5",
          )}
        >
          {children}
        </div>
        {footer ? (
          <footer className="shrink-0 border-t border-[#e8eef6] bg-[rgb(250_253_255/0.96)] px-4 py-3 sm:px-5">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
