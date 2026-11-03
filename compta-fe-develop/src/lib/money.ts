export function formatMoneyFromCents(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(cents));
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return `${sign}${grouped},${fraction} €`;
}

function groupThousands(value: number) {
  return String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Whole-euro amount in the dashboard notation, e.g. `128 450 €`. */
export function formatEuro(value: number) {
  return `${value < 0 ? "-" : ""}${groupThousands(value)} €`;
}

/** Compact euro amount, e.g. `37,7 k€` or `1,2 M€`. */
export function formatEuroCompact(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${formatDecimal(value / 1_000_000, 1)} M€`;
  if (absolute >= 1_000) return `${formatDecimal(value / 1_000, 1)} k€`;
  return formatEuro(value);
}

export function formatDecimal(value: number, digits: number) {
  return value.toFixed(digits).replace(".", ",");
}

export function formatPercent(ratio: number, digits = 1) {
  return `${formatDecimal(ratio * 100, digits)}%`;
}

/**
 * Keeps only numeric amount characters for price/money fields.
 * Allows digits, spaces (thousands), and a single decimal separator (`,` or `.`).
 * Letters and other symbols are stripped — never stored in the input.
 */
export function sanitizeAmountInput(value: string) {
  const cleaned = value.replace(/[^\d\s,.]/g, "");
  const commaIdx = cleaned.indexOf(",");
  const periodIdx = cleaned.indexOf(".");

  let sepIdx = -1;
  let sep = "";
  if (commaIdx >= 0 && (periodIdx < 0 || commaIdx < periodIdx)) {
    sepIdx = commaIdx;
    sep = ",";
  } else if (periodIdx >= 0) {
    sepIdx = periodIdx;
    sep = ".";
  }

  if (sepIdx < 0) {
    return cleaned.replace(/[^\d\s]/g, "");
  }

  const intPart = cleaned.slice(0, sepIdx).replace(/[^\d\s]/g, "");
  const fracPart = cleaned.slice(sepIdx + 1).replace(/\D/g, "");
  return `${intPart}${sep}${fracPart}`;
}

/** Digits-only sanitizer for quantity fields (no decimal). */
export function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, "");
}

/** Parses the dashboard notation (`18 600 €`, `68,4%`) back to a number. */
export function parseAmount(value: string) {
  const numeric = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
}
