export type QuoteStatus =
  | "draft"
  | "sent"
  | "review"
  | "accepted"
  | "rejected"
  | "expired";

export type WorkKey =
  | "work.office"
  | "work.showroom"
  | "work.lighting"
  | "work.consulting"
  | "work.facade"
  | "work.electrical"
  | "work.hvac"
  | "work.joinery";

export type QuoteLine = {
  id: string;
  label: string;
  qty: number;
  unitHtCents: number;
  /** Optional catalog link — historical lines keep their own unitHtCents snapshot. */
  productId?: string;
};

export type QuoteActivity = {
  id: string;
  at: string;
  messageKey:
    | "activity.quoteAccepted"
    | "activity.quoteSent"
    | "activity.quoteCreated"
    | "activity.quoteReview"
    | "activity.quoteRejected"
    | "activity.quoteExpired"
    | "activity.customerReply"
    | "activity.reminderScheduled";
  values: Record<string, string | number>;
};

export type QuoteRecord = {
  id: string;
  customerId: string;
  workKey: WorkKey;
  ownerId: string;
  status: QuoteStatus;
  validUntil: string;
  vatRate: number;
  lines: QuoteLine[];
  activity: QuoteActivity[];
  createdAt: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
};

export type OwnerRecord = {
  id: string;
  name: string;
  initials: string;
};

export type QuoteTotals = {
  htCents: number;
  vatCents: number;
  ttcCents: number;
};

export function quoteTotals(quote: QuoteRecord): QuoteTotals {
  const htCents = quote.lines.reduce(
    (sum, line) => sum + line.qty * line.unitHtCents,
    0,
  );
  const vatCents = Math.round((htCents * quote.vatRate) / 100);
  return { htCents, vatCents, ttcCents: htCents + vatCents };
}

export type DatePreset = "any" | "month" | "quarter" | "next7" | "overdue";

export type QuoteFilters = {
  query: string;
  statuses: QuoteStatus[];
  ownerId: string | null;
  customerId: string | null;
  amountMinCents: number | null;
  amountMaxCents: number | null;
  datePreset: DatePreset;
};

export type QuoteSortKey = "id" | "customer" | "total" | "status" | "validUntil";

export type QuoteSort = {
  key: QuoteSortKey;
  direction: "asc" | "desc";
};

export type ColumnId = "owner" | "validity";

export type Density = "comfortable" | "compact";

export type SavedView = {
  id: string;
  name: string;
  builtIn: boolean;
  filters: QuoteFilters;
  sort: QuoteSort;
  hiddenColumns: ColumnId[];
  density: Density;
};

export const emptyFilters: QuoteFilters = {
  query: "",
  statuses: [],
  ownerId: null,
  customerId: null,
  amountMinCents: null,
  amountMaxCents: null,
  datePreset: "any",
};

export const ledgerToday = "2026-10-02";

export function nextActionFor(quote: QuoteRecord, today = ledgerToday) {
  if (quote.status === "review") return { kind: "approve" as const, urgent: true };
  if (quote.status === "accepted") return { kind: "convert" as const, urgent: false };
  if (quote.status === "draft") return { kind: "send" as const, urgent: false };
  if (quote.status === "sent") {
    const until = Date.parse(quote.validUntil);
    const now = Date.parse(today);
    const withinWeek = until >= now && until - now <= 7 * 24 * 60 * 60 * 1000;
    return { kind: "followUp" as const, urgent: withinWeek };
  }
  return { kind: "none" as const, urgent: false };
}
