/** Calendar date helpers for document validity — no hardcoded business dates. */

export function addMonthsIso(from: Date, months: number) {
  const next = new Date(from.getTime());
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) next.setDate(0);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const date = String(next.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export function todayIso(from = new Date()) {
  return addMonthsIso(from, 0);
}

/** Add months to an ISO calendar date without timezone shifts. */
export function addMonthsToIso(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return addMonthsIso(new Date(year, month - 1, day), months);
}

/** Add calendar days to an ISO date without timezone shifts. */
export function addDaysToIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
