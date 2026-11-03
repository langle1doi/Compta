"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

/**
 * Soft-UI toast for success / error / info notices.
 * Anchored to the right side — never use window.alert.
 */
export function SoftToast({
  message,
  tone = "info",
  onDismiss,
  durationMs = 3200,
}: {
  message: string;
  tone?: "info" | "success" | "error";
  onDismiss: () => void;
  durationMs?: number;
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => onDismiss(), durationMs);
    return () => window.clearTimeout(timer);
    // Intentionally only re-arm when the message changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable dismiss callback from parents is not guaranteed
  }, [message, durationMs]);

  if (!message || !mounted) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed top-4 right-4 z-[130] flex w-[min(360px,calc(100vw-2rem))] justify-end sm:top-5 sm:right-5"
      role="status"
    >
      <p
        className={cn(
          "pointer-events-auto w-full rounded-[12px] px-3.5 py-2.5 text-sm font-medium shadow-[0_12px_36px_rgb(29_43_68/0.16)] ring-1",
          tone === "error" && "bg-[#fff4f2] text-[#b54841] ring-[#f0cfc8]",
          tone === "success" && "bg-[#eef8f1] text-[#1f7a45] ring-[#cfe8d6]",
          tone === "info" && "bg-[#e7efff] text-[#044ce2] ring-[#c9d8f7]",
        )}
      >
        {message}
      </p>
    </div>,
    document.body,
  );
}
