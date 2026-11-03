"use client";

import { Maximize2 } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const DOC_WIDTH_MM = 210;
const MM_TO_PX = 3.7795275591;

type FrameVariant = "editor" | "panel" | "thumbnail";

export function DocumentPreviewFrame({
  children,
  variant = "panel",
  label = "Live preview",
  expandLabel,
  onExpand,
  className,
}: {
  children: ReactNode;
  variant?: FrameVariant;
  label?: string;
  expandLabel?: string;
  onExpand?: () => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    function measure() {
      if (!host) return;
      const width = host.clientWidth;
      const naturalPx = DOC_WIDTH_MM * MM_TO_PX;
      const next = width > 0 ? Math.min(1, width / naturalPx) : 0.45;
      setScale(next);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const compact = variant === "thumbnail";
  const zoomPct = Math.round(scale * 100);

  return (
    <div
      className={cn(
        "document-preview-frame",
        `document-preview-frame--${variant}`,
        className,
      )}
    >
      {!compact && label ? (
        <div className="document-preview-frame__chrome">
          <div className="document-preview-frame__chrome-left">
            <span className="document-preview-frame__dot" />
            <span className="document-preview-frame__dot" />
            <span className="document-preview-frame__dot" />
            <span className="document-preview-frame__label">{label}</span>
          </div>
          <div className="document-preview-frame__chrome-right">
            <span className="document-preview-frame__badge">A4</span>
            <span className="document-preview-frame__zoom">{zoomPct}%</span>
            {onExpand ? (
              <button
                aria-label={expandLabel ?? "Expand preview"}
                className="action-motion soft-button inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[10px] font-semibold text-[#2458d6]"
                type="button"
                onClick={onExpand}
              >
                <Maximize2 aria-hidden="true" className="h-3 w-3" />
                <span className="hidden sm:inline">{expandLabel ?? "Expand"}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="document-preview-frame__stage">
        <div className="document-preview-frame__paper" ref={hostRef}>
          <div className="document-preview-frame__scaler">
            <div
              className="document-preview-frame__scaled"
              style={{
                transform: `scale(${scale})`,
                width: `${DOC_WIDTH_MM}mm`,
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
