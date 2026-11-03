"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

/**
 * Soft-UI confirmation surface. Prefer this over window.confirm / alert.
 * Portaled to document.body so it stacks above FormSheet.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  error,
  confirmLabel,
  cancelLabel,
  danger,
  confirming = false,
  onConfirm,
  onCancel,
  zIndexClassName = "z-[120]",
}: {
  open: boolean;
  title: string;
  body?: string;
  /** Inline mutation error (e.g. overpayment) — never fail silently. */
  error?: string | null;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  zIndexClassName?: string;
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-[#063586]/35 px-4`}
    >
      <button aria-label={cancelLabel} className="absolute inset-0" type="button" onClick={onCancel} />
      <div
        aria-labelledby="confirm-dialog-title"
        aria-describedby={error ? "confirm-dialog-error" : undefined}
        className="relative z-10 w-full max-w-[min(420px,100%)] rounded-[16px] bg-white p-5 shadow-[0_22px_70px_rgb(29_43_68/0.18)] ring-1 ring-[#e1e7f1]"
        role="alertdialog"
      >
        <h2 className="text-base font-semibold text-[#063586]" id="confirm-dialog-title">
          {title}
        </h2>
        {body ? <p className="mt-2 text-sm leading-6 text-[#66758d]">{body}</p> : null}
        {error ? (
          <p
            className="mt-3 rounded-[10px] bg-[#fff4f2] px-3 py-2 text-sm font-medium text-[#b54841] ring-1 ring-[#f0cfc8]"
            id="confirm-dialog-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            disabled={confirming}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={
              danger
                ? "action-motion min-h-10 rounded-[10px] bg-[#c9564f] px-3 text-sm font-semibold text-white hover:bg-[#b54841] disabled:opacity-60"
                : "action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-60"
            }
            disabled={confirming}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
