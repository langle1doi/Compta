"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { formatEuro } from "@/lib/money";

import type { ApprovalRulesConfig } from "../types";

export function ApprovalRulesCard({ initial }: { initial: ApprovalRulesConfig }) {
  const t = useTranslations("usersPermissions");
  const [enabled, setEnabled] = useState(initial.requireApprovalAboveThreshold);
  const [threshold, setThreshold] = useState(String(initial.quoteApprovalThresholdEuro));
  const parsed = Number(threshold.replace(/\s/g, "")) || 0;

  return (
    <section
      aria-labelledby="approval-rules-title"
      className="dashboard-card dashboard-enter flex min-w-0 flex-col p-3.5"
    >
      <h3 className="dashboard-card-title" id="approval-rules-title">
        {t("approval.title")}
      </h3>
      <p className="mt-1 text-[12px] leading-5 text-[#7a899e]">{t("approval.subtitle")}</p>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
          {t("approval.threshold")}
        </span>
        <div className="flex h-10 items-center gap-2 rounded-[10px] border border-[#dfe6f1] bg-white px-3">
          <input
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#063586] outline-none tabular-nums"
            inputMode="numeric"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
          <span className="text-sm font-semibold text-[#7a899e]">€</span>
        </div>
      </label>

      <button
        aria-checked={enabled}
        className="series-switch mt-3 w-full justify-between gap-3 rounded-[10px] px-1 py-1 text-left"
        role="switch"
        type="button"
        onClick={() => setEnabled((value) => !value)}
      >
        <span className="min-w-0 text-[12px] font-medium text-[#405069]">
          {t("approval.require")}
        </span>
        <span className="series-switch__track shrink-0">
          <span className="series-switch__knob" />
        </span>
      </button>

      <p className="mt-2 text-[11px] leading-4 text-[#7a899e]">
        {enabled
          ? t("approval.description", { amount: formatEuro(parsed) })
          : t("approval.disabled")}
      </p>
    </section>
  );
}
