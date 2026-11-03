"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { SoftDatePicker } from "@/components/compte/soft-date-picker";
import { SoftSelect } from "@/components/compte/soft-select";
import { FormSheet } from "@/components/forms/form-sheet";
import { parseAmount } from "@/lib/money";

import type { ExpenseCategory, Project } from "../model";
import { createExpense } from "../store";

type OcrState = "idle" | "uploading" | "processing" | "success" | "failed";

export function NewExpenseSheet({
  open,
  companyId,
  projects,
  onClose,
  onCreated,
}: {
  open: boolean;
  companyId: string;
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("projects");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("");
  const [projectId, setProjectId] = useState("");
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [ocrState, setOcrState] = useState<OcrState>("idle");
  const [ocrApplied, setOcrApplied] = useState(false);
  const [error, setError] = useState("");

  const projectOptions = useMemo(
    () => [
      { value: "", label: t("expense.noProject") },
      ...projects
        .filter((project) => project.companyId === companyId)
        .map((project) => ({
          value: project.id,
          label: `${project.code} · ${project.name}`,
        })),
    ],
    [companyId, projects, t],
  );

  function handleReceipt(file: File | null) {
    if (!file) return;
    setReceiptName(file.name);
    setOcrState("uploading");
    window.setTimeout(() => setOcrState("processing"), 400);
    window.setTimeout(() => {
      // Honest mock OCR suggestion — user can edit.
      setSupplier((current) => current || "Suggested Supplier");
      setAmount((current) => current || "1250,00");
      setVat((current) => current || "250,00");
      setDate((current) => current || new Date().toISOString().slice(0, 10));
      setOcrApplied(true);
      setOcrState("success");
    }, 1400);
  }

  function submit(asDraft: boolean) {
    const amountCents = Math.round(parseAmount(amount) * 100);
    const vatCents = Math.round(parseAmount(vat || "0") * 100);
    if (!date || !amountCents) {
      setError(t("expense.required"));
      return;
    }
    createExpense({
      projectId: projectId || null,
      companyId,
      submittedBy: "Current user",
      date,
      supplier: supplier.trim() || t("expense.untitled"),
      category,
      description: description.trim(),
      amountCents,
      vatCents,
      receiptName,
      ocrApplied,
      status: asDraft ? "draft" : "pending_approval",
    });
    onCreated();
  }

  return (
    <FormSheet
      open={open}
      title={t("expense.createTitle")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[70]"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
            type="button"
            onClick={onClose}
          >
            {t("form.cancel")}
          </button>
          <button
            className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
            type="button"
            onClick={() => submit(true)}
          >
            {t("expense.saveDraft")}
          </button>
          <button
            className="action-motion soft-primary h-9 rounded-[9px] px-3 text-xs font-semibold text-white"
            type="button"
            onClick={() => submit(false)}
          >
            {t("expense.submit")}
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-1 py-1">
        <div className="rounded-[10px] border border-dashed border-[#d7deea] bg-[#fbfcfe] px-3 py-3">
          <p className="text-[11px] font-semibold text-[#24334c]">{t("expense.receipt")}</p>
          <p className="mt-0.5 text-[10px] text-[#7d8aa0]">{t("expense.receiptHint")}</p>
          <label className="action-motion soft-button mt-2 inline-flex h-8 cursor-pointer items-center rounded-[8px] px-2.5 text-[10px] font-semibold text-[#405069]">
            {t("expense.upload")}
            <input
              accept="image/*,.pdf"
              className="hidden"
              type="file"
              onChange={(event) => handleReceipt(event.target.files?.[0] ?? null)}
            />
          </label>
          {receiptName ? (
            <p className="mt-1.5 text-[10px] text-[#516078]">{receiptName}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-[#98a4b5]">
            {ocrState === "idle" && t("expense.ocr.idle")}
            {ocrState === "uploading" && t("expense.ocr.uploading")}
            {ocrState === "processing" && t("expense.ocr.processing")}
            {ocrState === "success" && t("expense.ocr.success")}
            {ocrState === "failed" && t("expense.ocr.failed")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SoftDatePicker
            label={t("expense.date")}
            required
            value={date}
            onChange={setDate}
          />
          <Field label={`${t("expense.amount")} *`}>
            <input
              className="h-9 w-full rounded-[9px] border border-[#e1e7f1] px-2.5 text-xs tabular-nums outline-none focus:border-[#044ce2]"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("expense.vat")}>
            <input
              className="h-9 w-full rounded-[9px] border border-[#e1e7f1] px-2.5 text-xs tabular-nums outline-none focus:border-[#044ce2]"
              value={vat}
              onChange={(event) => setVat(event.target.value)}
            />
          </Field>
          <Field label={t("expense.category")}>
            <SoftSelect
              label={t("expense.category")}
              hideLabel
              options={(
                ["travel", "materials", "subcontracting", "other"] as const
              ).map((value) => ({
                value,
                label: t(`expense.categories.${value}`),
              }))}
              value={category}
              onChange={(value) => setCategory(value as ExpenseCategory)}
            />
          </Field>
        </div>
        <Field label={t("expense.supplier")}>
          <input
            className="h-9 w-full rounded-[9px] border border-[#e1e7f1] px-2.5 text-xs outline-none focus:border-[#044ce2]"
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
          />
        </Field>
        <Field label={t("expense.project")}>
          <SoftSelect
            label={t("expense.project")}
            hideLabel
            options={projectOptions}
            value={projectId}
            onChange={setProjectId}
          />
        </Field>
        <Field label={t("expense.description")}>
          <textarea
            className="min-h-[64px] w-full rounded-[9px] border border-[#e1e7f1] px-2.5 py-2 text-xs outline-none focus:border-[#044ce2]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        {error ? <p className="text-[11px] text-[#c9564f]">{error}</p> : null}
      </div>
    </FormSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-semibold text-[#7d8aa0]">{label}</span>
      {children}
    </label>
  );
}
