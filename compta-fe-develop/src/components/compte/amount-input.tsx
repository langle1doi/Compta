"use client";

import type { InputHTMLAttributes } from "react";

import { sanitizeAmountInput, sanitizeIntegerInput } from "@/lib/money";
import { cn } from "@/lib/utils";

type AmountInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** `decimal` = money/price; `integer` = qty-style whole numbers. */
  mode?: "decimal" | "integer";
};

/**
 * Numeric-only amount field for COMPTE money/price inputs.
 * Blocks letters and non-numeric symbols while typing or pasting.
 */
export function AmountInput({
  value,
  onValueChange,
  mode = "decimal",
  className,
  ...props
}: AmountInputProps) {
  function sanitize(raw: string) {
    return mode === "integer" ? sanitizeIntegerInput(raw) : sanitizeAmountInput(raw);
  }

  return (
    <input
      {...props}
      autoComplete="off"
      className={cn("tabular-nums", className)}
      inputMode={mode === "integer" ? "numeric" : "decimal"}
      spellCheck={false}
      type="text"
      value={value}
      onChange={(event) => {
        onValueChange(sanitize(event.target.value));
      }}
      onKeyDown={(event) => {
        // Block scientific-notation / sign keys that slip through on some keyboards.
        if (event.key.length === 1 && /[eE+\-]/.test(event.key) && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
        }
        props.onKeyDown?.(event);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData("text");
        const start = event.currentTarget.selectionStart ?? value.length;
        const end = event.currentTarget.selectionEnd ?? value.length;
        onValueChange(sanitize(`${value.slice(0, start)}${pasted}${value.slice(end)}`));
      }}
    />
  );
}
