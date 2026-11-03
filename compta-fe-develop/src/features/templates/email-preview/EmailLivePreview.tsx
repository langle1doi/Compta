"use client";

import { Maximize2 } from "lucide-react";

import { cn } from "@/lib/utils";

import "../document-preview/document-preview.css";
import "./email-live-preview.css";

export type EmailLivePreviewProps = {
  from: string;
  to: string;
  subject: string;
  body: string;
  signature: string;
  fromLabel?: string;
  toLabel?: string;
  previewHint?: string;
  label?: string;
  expandLabel?: string;
  onExpand?: () => void;
  className?: string;
  /** Full-bleed message without outer chrome (lightbox). */
  bare?: boolean;
};

/**
 * Live email canvas — same preview chrome language as document Quote preview.
 */
export function EmailLivePreview({
  from,
  to,
  subject,
  body,
  signature,
  fromLabel = "From",
  toLabel = "To",
  previewHint,
  label = "Email preview",
  expandLabel,
  onExpand,
  className,
  bare = false,
}: EmailLivePreviewProps) {
  const message = (
    <article className="email-live-preview__paper">
      <header className="email-live-preview__meta">
        <p className="email-live-preview__subject">{subject}</p>
        <dl className="email-live-preview__headers">
          <div className="email-live-preview__header-row">
            <dt>{fromLabel}</dt>
            <dd>{from}</dd>
          </div>
          <div className="email-live-preview__header-row">
            <dt>{toLabel}</dt>
            <dd>{to}</dd>
          </div>
        </dl>
        {previewHint ? (
          <p className="email-live-preview__hint">{previewHint}</p>
        ) : null}
      </header>
      <div className="email-live-preview__body">
        <p className="email-live-preview__body-text">{body}</p>
        {signature ? (
          <p className="email-live-preview__signature">{signature}</p>
        ) : null}
      </div>
    </article>
  );

  if (bare) {
    return (
      <div className={cn("email-live-preview email-live-preview--bare", className)}>
        {message}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "document-preview-frame email-live-preview",
        className,
      )}
    >
      <div className="document-preview-frame__chrome">
        <div className="document-preview-frame__chrome-left">
          <span className="document-preview-frame__dot" />
          <span className="document-preview-frame__dot" />
          <span className="document-preview-frame__dot" />
          <span className="document-preview-frame__label">{label}</span>
        </div>
        <div className="document-preview-frame__chrome-right">
          <span className="document-preview-frame__badge">EMAIL</span>
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

      <div className="document-preview-frame__stage email-live-preview__stage">
        {message}
      </div>
    </div>
  );
}
