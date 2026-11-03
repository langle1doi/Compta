"use client";

import { Maximize2, Minus, Plus, X } from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function TemplatePreviewLightbox({
  open,
  title,
  closeLabel,
  zoomInLabel,
  zoomOutLabel,
  zoom,
  onZoomChange,
  onClose,
  children,
  zIndexClassName = "z-[130]",
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onClose: () => void;
  children: ReactNode;
  zIndexClassName?: string;
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const zoomPct = Math.round(zoom * 100);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center px-3 py-4 sm:px-6",
        "bg-[rgb(55_65_81/0.8)] backdrop-blur-[12px]",
        zIndexClassName,
      )}
    >
      <button
        aria-label={closeLabel}
        className="absolute inset-0"
        type="button"
        onClick={onClose}
      />
      <div
        aria-labelledby="template-preview-lightbox-title"
        className={cn(
          "relative z-10 flex max-h-[min(920px,92vh)] w-full max-w-[min(920px,100%)] flex-col overflow-hidden rounded-[20px]",
          "border border-white/35 bg-[rgb(75_85_99/0.55)]",
          "shadow-[0_28px_80px_rgb(15_23_42/0.35)]",
          "backdrop-blur-2xl backdrop-saturate-125",
          "ring-1 ring-white/20",
        )}
        role="dialog"
      >
        <header
          className={cn(
            "flex shrink-0 items-center justify-between gap-2 px-3.5 py-2.5",
            "border-b border-white/15 bg-[rgb(55_65_81/0.35)]",
            "backdrop-blur-md",
          )}
        >
          <div className="min-w-0">
            <p
              className="truncate text-[13px] font-semibold text-white"
              id="template-preview-lightbox-title"
            >
              {title}
            </p>
            <p className="text-[10px] font-semibold text-white/65">{zoomPct}%</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-label={zoomOutLabel}
              className="action-motion grid h-8 w-8 place-items-center rounded-[8px] bg-white/10 text-white/85 hover:bg-white/16 disabled:opacity-40"
              disabled={zoom <= 0.6}
              type="button"
              onClick={() => onZoomChange(Math.max(0.6, Math.round((zoom - 0.15) * 100) / 100))}
            >
              <Minus aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label={zoomInLabel}
              className="action-motion grid h-8 w-8 place-items-center rounded-[8px] bg-white/10 text-white/85 hover:bg-white/16 disabled:opacity-40"
              disabled={zoom >= 1.4}
              type="button"
              onClick={() => onZoomChange(Math.min(1.4, Math.round((zoom + 0.15) * 100) / 100))}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label={closeLabel}
              className="action-motion grid h-8 w-8 place-items-center rounded-[8px] bg-white/10 text-white/85 hover:bg-white/16"
              type="button"
              onClick={onClose}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div
          className={cn(
            "dashboard-scroll min-h-0 flex-1 overflow-auto p-4 sm:p-6",
            "bg-[rgb(55_65_81/0.22)]",
          )}
        >
          <div
            className="mx-auto origin-top"
            style={{
              width: "fit-content",
              maxWidth: "100%",
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
            }}
          >
            <div
              className={cn(
                "overflow-hidden rounded-[14px] bg-white",
                "shadow-[0_18px_48px_rgb(15_23_42/0.28)]",
                "ring-1 ring-white/40",
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ExpandPreviewButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "action-motion soft-button inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#2458d6]",
        className,
      )}
      type="button"
      onClick={onClick}
    >
      <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
