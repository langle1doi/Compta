"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FormSheet } from "@/components/forms/form-sheet";
import { cn } from "@/lib/utils";

import { previewCsvImport } from "../services/customers-service";
import type { CsvImportRow } from "../types";

const steps = ["upload", "map", "validate", "review", "import"] as const;

export function ImportCustomersDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("customers.import");
  const [step, setStep] = useState<(typeof steps)[number]>("upload");
  const [rows, setRows] = useState<CsvImportRow[]>([]);

  return (
    <FormSheet
      closeLabel={t("close")}
      description={t("body")}
      open={open}
      title={t("title")}
      widthClassName="sm:max-w-[560px]"
      zIndexClassName="z-[80]"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
            onClick={onClose}
            type="button"
          >
            {t("close")}
          </button>
          {step !== "upload" && step !== "import" ? (
            <button
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
              onClick={() => {
                const index = steps.indexOf(step);
                setStep(steps[Math.min(index + 1, steps.length - 1)]!);
              }}
              type="button"
            >
              {t("next")}
            </button>
          ) : null}
          {step === "import" ? (
            <button
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
              onClick={onClose}
              type="button"
            >
              {t("done")}
            </button>
          ) : null}
        </div>
      }
    >
      <ol className="mb-4 flex flex-wrap gap-1.5">
        {steps.map((item) => (
          <li
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              step === item ? "bg-[#e7efff] text-[#044ce2]" : "bg-[#eef3fa] text-[#7d8aa0]",
            )}
            key={item}
          >
            {t(`steps.${item}`)}
          </li>
        ))}
      </ol>

      {step === "upload" ? (
        <div className="rounded-[12px] border border-dashed border-[#c9d7ec] bg-[#f7faff] px-4 py-10 text-center">
          <p className="text-sm font-semibold text-[#24334c]">{t("uploadTitle")}</p>
          <p className="mt-1 text-xs text-[#7d8aa0]">{t("uploadHint")}</p>
          <button
            className="action-motion soft-primary mt-4 min-h-10 rounded-[10px] px-4 text-sm font-semibold text-white"
            onClick={() => {
              setRows(previewCsvImport());
              setStep("map");
            }}
            type="button"
          >
            {t("useSample")}
          </button>
        </div>
      ) : null}

      {step === "map" ? (
        <div className="space-y-2 text-sm text-[#405069]">
          <p>{t("mapBody")}</p>
          {["name", "email", "type", "siret", "vat"].map((field) => (
            <div
              className="flex items-center justify-between rounded-[9px] border border-[#e8eef6] bg-white px-3 py-2"
              key={field}
            >
              <span className="font-medium">{t(`fields.${field}`)}</span>
              <span className="text-xs text-[#7d8aa0]">CSV · {field}</span>
            </div>
          ))}
        </div>
      ) : null}

      {step === "validate" || step === "review" || step === "import" ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              className={cn(
                "rounded-[10px] border px-3 py-2 text-sm",
                row.status === "valid" && "border-[#cfeedd] bg-[#f3fbf7]",
                row.status === "warning" && "border-[#ffe2c2] bg-[#fff8ef]",
                row.status === "duplicate" && "border-[#ffd8a8] bg-[#fff6ea]",
                row.status === "error" && "border-[#ffc9c2] bg-[#fff4f2]",
              )}
              key={row.id}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#24334c]">{row.name || "—"}</p>
                <span className="text-[11px] font-semibold uppercase">{t(`row.${row.status}`)}</span>
              </div>
              <p className="text-xs text-[#7d8aa0]">{row.email || t("missingEmail")}</p>
              {row.message ? <p className="mt-1 text-xs text-[#66758d]">{row.message}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {step === "import" ? (
        <p className="mt-4 rounded-[10px] bg-[#e7efff] px-3 py-2 text-sm text-[#044ce2]">
          {t("mockComplete")}
        </p>
      ) : null}
    </FormSheet>
  );
}
