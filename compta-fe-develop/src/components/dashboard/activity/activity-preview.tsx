"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import type { ActivityStatus } from "@/features/activity/model";

import { ActivityStatus as StatusChip } from "./activity-status";

export type ActivityPreviewModel = {
  id: string;
  title: string;
  body?: string;
  status?: ActivityStatus;
  statusLabel?: string;
  rows: Array<{ label: string; value: string }>;
  href?: string;
  hrefLabel?: string;
  note?: string;
};

export function ActivityPreview({
  model,
  closeLabel,
  onClose,
}: {
  model: ActivityPreviewModel | null;
  closeLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState<ActivityPreviewModel | null>(model);
  if (model && model !== visible) setVisible(model);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (model && !dialog.open) dialog.showModal();
    if (!model && dialog.open) dialog.close();
  }, [model]);

  const content = visible;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="activity-preview-title"
      className="activity-preview"
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      onClose={onClose}
    >
      {content ? (
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold tracking-[-0.01em] text-[#063586]" id="activity-preview-title">
              {content.title}
            </h2>
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[#dfe6f1] text-[#506078] hover:border-[#b9d0fb] hover:text-[#044ce2]"
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          {content.status && content.statusLabel ? (
            <div className="mt-3">
              <StatusChip status={content.status} label={content.statusLabel} />
            </div>
          ) : null}
          {content.body ? <p className="mt-3 text-sm leading-6 text-[#405069] tabular-nums">{content.body}</p> : null}
          {content.rows.length > 0 ? (
            <dl className="mt-4 space-y-2 border-t border-[#edf1f6] pt-4 text-sm">
              {content.rows.map((row) => (
                <div className="flex items-baseline justify-between gap-4" key={row.label}>
                  <dt className="text-[#66758d]">{row.label}</dt>
                  <dd className="min-w-0 text-right font-medium text-[#063586] tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {content.note ? <p className="mt-4 text-sm leading-6 text-[#405069]">{content.note}</p> : null}
          {content.href && content.hrefLabel ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-[#044ce2]" href={content.href}>
              {content.hrefLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
