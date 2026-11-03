"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { AmountInput } from "@/components/compte/amount-input";
import { SoftSelect } from "@/components/compte/soft-select";
import { FormSheet } from "@/components/forms/form-sheet";
import { parseAmount } from "@/lib/money";

import { iconKeyForType } from "../icons";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  PRODUCT_VAT_RATES,
  type ProductDraftInput,
  type ProductType,
} from "../model";

export function ProductFormSheet({
  open,
  companyId,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  companyId: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ProductDraftInput) => { ok: boolean; error?: string };
}) {
  const t = useTranslations("products");
  const [type, setType] = useState<ProductType>("service");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<(typeof PRODUCT_CATEGORIES)[number]>("consulting");
  const [unit, setUnit] = useState<(typeof PRODUCT_UNITS)[number]>("hour");
  const [unitPrice, setUnitPrice] = useState("");
  const [cost, setCost] = useState("");
  const [vatRate, setVatRate] = useState("20");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  function submit() {
    setTouched(true);
    const unitPriceCents = Math.round(parseAmount(unitPrice) * 100);
    const costCents = Math.round(parseAmount(cost || "0") * 100);
    if (!name.trim() || !code.trim()) {
      setError(t("form.required"));
      return;
    }
    if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
      setError(t("form.invalidPrice"));
      return;
    }
    if (!Number.isFinite(costCents) || costCents < 0) {
      setError(t("form.invalidCost"));
      return;
    }
    const result = onSave({
      companyId,
      code,
      name,
      description,
      type,
      unit,
      unitPriceCents,
      costCents,
      vatRate: Number(vatRate),
      categoryId,
      status,
      iconKey: iconKeyForType(type),
    });
    if (!result.ok) {
      setError(
        result.error === "duplicate_code" ? t("form.duplicateCode") : t("form.failed"),
      );
      return;
    }
    setError(null);
  }

  return (
    <FormSheet
      closeLabel={t("close")}
      description={t("form.subtitle")}
      footer={
        <div className="flex justify-end gap-2">
          <button
            className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
            type="button"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            aria-busy={saving}
            className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-40"
            disabled={saving}
            type="button"
            onClick={submit}
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      }
      open={open}
      title={t("form.title")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[60]"
      onClose={onClose}
    >
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold text-[#66758d]">{t("fields.type")} *</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["good", "service"] as const).map((option) => (
              <button
                className={`rounded-[10px] border px-3 py-2.5 text-left transition-colors ${
                  type === option
                    ? "border-[#044ce2]/35 bg-[#eef4ff]"
                    : "border-[#e1e7f1] bg-white"
                }`}
                key={option}
                type="button"
                onClick={() => {
                  setType(option);
                  setCategoryId(option === "good" ? "accessories" : "consulting");
                  setUnit(option === "good" ? "unit" : "hour");
                }}
              >
                <p className="text-xs font-semibold text-[#24334c]">{t(`type.${option}`)}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-[#7d8aa0]">
                  {t(`typeHelp.${option}`)}
                </p>
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-[11px] font-semibold text-[#66758d]">{t("fields.name")} *</span>
          <input
            className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <span className="mt-1 block text-[11px] text-[#7d8aa0]">{t("form.nameHelp")}</span>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-[#66758d]">{t("fields.code")} *</span>
          <input
            className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <span className="mt-1 block text-[11px] text-[#7d8aa0]">{t("form.codeHelp")}</span>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-[#66758d]">{t("fields.description")}</span>
          <textarea
            className="soft-input mt-1 min-h-[72px] w-full rounded-[9px] px-3 py-2 text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <SoftSelect
          label={t("fields.category")}
          options={PRODUCT_CATEGORIES.map((id) => ({
            value: id,
            label: t(`categories.${id}`),
          }))}
          value={categoryId}
          onChange={(value) => setCategoryId(value as typeof categoryId)}
        />
        <SoftSelect
          label={`${t("fields.unit")} *`}
          options={PRODUCT_UNITS.map((id) => ({
            value: id,
            label: t(`units.${id}`),
          }))}
          value={unit}
          onChange={(value) => setUnit(value as typeof unit)}
        />
        <label className="block">
          <span className="text-[11px] font-semibold text-[#66758d]">
            {t("fields.unitPrice")} *
          </span>
          <AmountInput
            className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c]"
            placeholder="0,00"
            value={unitPrice}
            onValueChange={setUnitPrice}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-[#66758d]">{t("fields.cost")}</span>
          <AmountInput
            className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c]"
            placeholder="0,00"
            value={cost}
            onValueChange={setCost}
          />
        </label>
        <SoftSelect
          label={`${t("fields.vat")} *`}
          options={PRODUCT_VAT_RATES.map((rate) => ({
            value: String(rate),
            label: `${rate}%`,
          }))}
          value={vatRate}
          onChange={setVatRate}
        />
        <SoftSelect
          label={t("fields.status")}
          options={[
            { value: "active", label: t("status.active") },
            { value: "inactive", label: t("status.inactive") },
          ]}
          value={status}
          onChange={(value) => setStatus(value as typeof status)}
        />
        {touched && error ? (
          <p className="text-xs font-medium text-[#c9564f]">{error}</p>
        ) : null}
      </div>
    </FormSheet>
  );
}
