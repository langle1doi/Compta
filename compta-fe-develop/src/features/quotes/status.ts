import type { Tone } from "@/mocks/dashboard/types";

import type { QuoteStatus } from "./model";

export const QUOTE_STATUS_ORDER: QuoteStatus[] = [
  "draft",
  "sent",
  "review",
  "accepted",
  "rejected",
  "expired",
];

export const quoteStatusTone: Record<QuoteStatus, Tone> = {
  draft: "slate",
  sent: "blue",
  review: "orange",
  accepted: "green",
  rejected: "red",
  expired: "slate",
};

/** Quote pipeline donut / legend — brighter midtones of the Dashboard status hues. */
export const quoteStatusColor: Record<QuoteStatus, string> = {
  draft: "#7f93b0",
  sent: "#2f6ef0",
  review: "#f59b2d",
  accepted: "#1fb36e",
  rejected: "#e24b45",
  expired: "#5d6d84",
};

export function statusI18nKey(status: QuoteStatus) {
  return `status.${status}` as const;
}
