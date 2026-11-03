"use client";

import { SoftSelect } from "@/components/compte/soft-select";
import { cn } from "@/lib/utils";

export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export function PageSizeSelect({
  value,
  options = DEFAULT_PAGE_SIZE_OPTIONS,
  label,
  formatOption,
  onChange,
  className,
  triggerClassName,
  disabled = false,
}: {
  value: number;
  options?: readonly number[];
  label: string;
  formatOption: (count: number) => string;
  onChange: (value: number) => void;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  return (
    <SoftSelect
      activeTone="solid"
      className={cn("w-auto shrink-0", className)}
      disabled={disabled}
      hideLabel
      label={label}
      options={options.map((size) => ({
        value: String(size),
        label: formatOption(size),
      }))}
      triggerClassName={cn(
        "!h-8 min-w-[7.5rem] rounded-[8px] px-2 text-[11px] font-semibold text-[#405069] shadow-[0_1px_2px_rgba(55,65,81,0.05),0_4px_10px_rgba(55,65,81,0.08)] focus-visible:ring-[3px] focus-visible:ring-[#044ce2]/25",
        triggerClassName,
      )}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
    />
  );
}
