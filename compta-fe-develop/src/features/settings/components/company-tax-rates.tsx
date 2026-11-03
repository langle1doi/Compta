"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { StatusBadge } from "@/components/dashboard/tone";
import { ApiError } from "@/lib/api/client";
import { useApiErrorMessage } from "@/lib/api/use-api-error";

import {
  useTaxRates,
  type CompanyView,
  type TaxRateDraft,
} from "../settings-service";

const emptyDraft: TaxRateDraft = {
  rate: "",
  label: "",
  legalMention: "",
  isDefault: false,
};

export function CompanyTaxRates({
  company,
  canManage,
}: {
  company: CompanyView;
  canManage: boolean;
}) {
  const t = useTranslations("settingsCompanies.taxRates");
  const { message, fieldMessage } = useApiErrorMessage();
  const { list, create, update } = useTaxRates(company);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState("");

  function describe(caught: unknown) {
    const field = caught instanceof ApiError ? caught.fields[0] : undefined;
    setError(field ? fieldMessage(field) : message(caught));
  }

  async function add() {
    setError("");
    try {
      await create.mutateAsync(draft);
      setDraft(emptyDraft);
    } catch (caught) {
      describe(caught);
    }
  }

  async function change(
    id: string,
    body: { is_default?: boolean; is_active?: boolean },
  ) {
    setError("");
    try {
      await update.mutateAsync({ id, body });
    } catch (caught) {
      describe(caught);
    }
  }

  const inputClass =
    "h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30";

  return (
    <section className="space-y-3">
      <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[#7a899e] uppercase">
        {t("title")}
      </h3>

      {list.isError ? (
        <p className="text-[12px] text-[#c9564f]">{message(list.error)}</p>
      ) : null}

      <ul className="space-y-1.5">
        {(list.data ?? []).map((rate) => (
          <li
            className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#e8eef6] px-3 py-2"
            key={rate.id}
          >
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className="truncate text-[13px] font-semibold text-[#24334c]"
                title={rate.label}
              >
                {rate.label}
              </span>
              <span className="text-[12px] text-[#7a899e]">
                {Number(rate.rate)} %
              </span>
              {rate.is_default ? (
                <StatusBadge size="xs" tone="blue">
                  {t("default")}
                </StatusBadge>
              ) : null}
              {!rate.is_active ? (
                <StatusBadge size="xs" tone="slate">
                  {t("inactive")}
                </StatusBadge>
              ) : null}
            </span>
            {canManage ? (
              <span className="flex shrink-0 items-center gap-1">
                {rate.is_active && !rate.is_default ? (
                  <button
                    className="min-h-9 rounded-[8px] px-2 text-[12px] font-semibold text-[#044ce2] hover:bg-[#eef4ff]"
                    type="button"
                    onClick={() => void change(rate.id, { is_default: true })}
                  >
                    {t("setDefault")}
                  </button>
                ) : null}
                <button
                  className="min-h-9 rounded-[8px] px-2 text-[12px] font-semibold text-[#506078] hover:bg-[#f4f7fb]"
                  type="button"
                  onClick={() =>
                    void change(rate.id, { is_active: !rate.is_active })
                  }
                >
                  {rate.is_active ? t("deactivate") : t("activate")}
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <div className="space-y-2 rounded-[12px] border border-[#e8eef6] p-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px]">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
                {t("label")}
              </span>
              <input
                className={inputClass}
                value={draft.label}
                onChange={(event) =>
                  setDraft({ ...draft, label: event.target.value })
                }
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
                {t("rate")}
              </span>
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.rate}
                onChange={(event) =>
                  setDraft({ ...draft, rate: event.target.value })
                }
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
              {t("legalMention")}
            </span>
            <input
              className={inputClass}
              value={draft.legalMention}
              onChange={(event) =>
                setDraft({ ...draft, legalMention: event.target.value })
              }
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-9 items-center gap-2 text-[12px] text-[#516078]">
              <input
                checked={draft.isDefault}
                className="accent-[#044ce2]"
                type="checkbox"
                onChange={(event) =>
                  setDraft({ ...draft, isDefault: event.target.checked })
                }
              />
              {t("default")}
            </label>
            <button
              className="action-motion soft-button inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-[#044ce2] disabled:opacity-50"
              disabled={
                create.isPending || !draft.label.trim() || !draft.rate.trim()
              }
              type="button"
              onClick={() => void add()}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              {t("add")}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-[12px] text-[#c9564f]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
