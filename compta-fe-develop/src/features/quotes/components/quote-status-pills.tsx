"use client";

import { SoftSelect } from "@/components/compte/soft-select";

import type { QuoteStatus } from "../model";
import { QUOTE_STATUS_ORDER } from "../status";

export type StatusFilterValue = "all" | QuoteStatus;

const OPTIONS: StatusFilterValue[] = ["all", ...QUOTE_STATUS_ORDER];

export function QuoteStatusPills({
  value,
  labels,
  onChange,
  ariaLabel,
}: {
  value: StatusFilterValue;
  labels: Record<StatusFilterValue, string>;
  onChange: (value: StatusFilterValue) => void;
  ariaLabel: string;
}) {
  return (
    <SoftSelect
      hideLabel
      label={ariaLabel}
      options={OPTIONS.map((option) => ({
        value: option,
        label: labels[option],
      }))}
      value={value}
      onChange={(next) => onChange(next as StatusFilterValue)}
    />
  );
}
