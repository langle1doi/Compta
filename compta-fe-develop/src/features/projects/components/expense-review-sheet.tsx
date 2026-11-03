"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { FormSheet } from "@/components/forms/form-sheet";
import { StatusBadge } from "@/components/dashboard/tone";
import { formatMoneyFromCents } from "@/lib/money";

import type { Project, ProjectExpense } from "../model";
import { expenseStatusTone } from "../status";
import { approveExpense, rejectExpense } from "../store";

export function ExpenseReviewSheet({
  open,
  expense,
  project,
  canApprove,
  onClose,
  onDone,
}: {
  open: boolean;
  expense: ProjectExpense | null;
  project: Project | null;
  canApprove: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("projects");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!expense) return null;
  const current = expense;

  function handleApprove() {
    approveExpense(current.id, "Marie Dupont");
    onDone();
  }

  function handleReject() {
    if (!reason.trim()) {
      setError(t("approvals.reasonRequired"));
      return;
    }
    rejectExpense(current.id, "Marie Dupont", reason);
    onDone();
  }

  return (
    <FormSheet
      open={open}
      title={t("approvals.reviewTitle")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[80]"
      onClose={onClose}
      footer={
        canApprove && expense.status === "pending_approval" ? (
          <div className="flex flex-wrap justify-end gap-2">
            {rejectOpen ? (
              <>
                <button
                  className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
                  type="button"
                  onClick={() => setRejectOpen(false)}
                >
                  {t("form.cancel")}
                </button>
                <button
                  className="action-motion h-9 rounded-[9px] bg-[#c9564f] px-3 text-xs font-semibold text-white"
                  type="button"
                  onClick={handleReject}
                >
                  {t("approvals.confirmReject")}
                </button>
              </>
            ) : (
              <>
                <button
                  className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#c9564f]"
                  type="button"
                  onClick={() => setRejectOpen(true)}
                >
                  {t("approvals.reject")}
                </button>
                <button
                  className="action-motion soft-primary h-9 rounded-[9px] px-3 text-xs font-semibold text-white"
                  type="button"
                  onClick={handleApprove}
                >
                  {t("approvals.approve")}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
              type="button"
              onClick={onClose}
            >
              {t("form.close")}
            </button>
          </div>
        )
      }
    >
      <div className="space-y-3 px-1 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge size="xs" tone={expenseStatusTone[expense.status]}>
            {t(`expense.status.${expense.status}`)}
          </StatusBadge>
          {expense.ocrApplied ? (
            <span className="rounded-full bg-[#eef3fb] px-2 py-0.5 text-[10px] font-semibold text-[#405069]">
              {t("expense.ocr.badge")}
            </span>
          ) : null}
        </div>

        <div className="rounded-[10px] border border-[#e8eef6] bg-[#fbfcfe] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#98a4b5]">
            {t("expense.receipt")}
          </p>
          <p className="mt-1 text-xs text-[#405069]">
            {expense.receiptName ?? t("expense.noReceipt")}
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Row label={t("expense.supplier")} value={expense.supplier} />
          <Row label={t("expense.date")} value={expense.date} />
          <Row
            label={t("expense.amount")}
            value={formatMoneyFromCents(expense.amountCents)}
          />
          <Row label={t("expense.vat")} value={formatMoneyFromCents(expense.vatCents)} />
          <Row
            label={t("expense.category")}
            value={t(`expense.categories.${expense.category}`)}
          />
          <Row
            label={t("expense.project")}
            value={project ? `${project.code} · ${project.name}` : t("expense.noProject")}
          />
          <Row label={t("expense.submittedBy")} value={expense.submittedBy} />
          <Row label={t("expense.description")} value={expense.description || "—"} />
        </dl>

        {rejectOpen ? (
          <label className="block min-w-0">
            <span className="mb-1 block text-[10px] font-semibold text-[#7d8aa0]">
              {t("approvals.reason")} *
            </span>
            <textarea
              className="min-h-[72px] w-full rounded-[9px] border border-[#e1e7f1] px-2.5 py-2 text-xs outline-none focus:border-[#044ce2]"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {error ? <p className="mt-1 text-[11px] text-[#c9564f]">{error}</p> : null}
          </label>
        ) : null}

        {expense.rejectionReason ? (
          <p className="rounded-[9px] border border-[#f3d6d4] bg-[#fff7f6] px-3 py-2 text-[11px] text-[#c9564f]">
            {t("approvals.rejectedReason", { reason: expense.rejectionReason })}
          </p>
        ) : null}
      </div>
    </FormSheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[9px] border border-[#edf2f8] px-2.5 py-2">
      <dt className="text-[10px] font-semibold text-[#98a4b5]">{label}</dt>
      <dd className="mt-0.5 truncate text-xs font-medium tabular-nums text-[#24334c]">
        {value}
      </dd>
    </div>
  );
}
