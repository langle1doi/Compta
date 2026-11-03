"use client";

import { useTranslations } from "next-intl";

import type { CustomerRecord } from "../types";

export function DuplicateCustomerDialog({
  open,
  candidates,
  onReview,
  onContinue,
  onClose,
}: {
  open: boolean;
  candidates: CustomerRecord[];
  onReview: (id: string) => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("customers.duplicate");
  if (!open) return null;
  const first = candidates[0];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#13284a]/28 p-4 backdrop-blur-[2px]">
      <div
        aria-labelledby="duplicate-title"
        aria-modal="true"
        className="dashboard-card w-full max-w-lg p-5"
        role="dialog"
      >
        <h3 className="text-lg font-semibold text-[#063586]" id="duplicate-title">
          {t("title")}
        </h3>
        <p className="mt-1 text-sm leading-6 text-[#66758d]">{t("body")}</p>

        {first ? (
          <div className="mt-4 rounded-[12px] border border-[#ffe2c2] bg-[#fff8ef] px-3 py-3">
            <p className="text-xs font-semibold tracking-wide text-[#c46b12] uppercase">
              {t("existing")}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#24334c]">{first.displayName}</p>
            <p className="text-xs text-[#7d8aa0]">{first.email}</p>
            <p className="text-xs text-[#7d8aa0]">{first.vatNumber ?? first.siret ?? "—"}</p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
            onClick={onClose}
            type="button"
          >
            {t("cancel")}
          </button>
          {first ? (
            <button
              className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#044ce2]"
              onClick={() => onReview(first.id)}
              type="button"
            >
              {t("review")}
            </button>
          ) : null}
          <button
            className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
            onClick={onContinue}
            type="button"
          >
            {t("continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
