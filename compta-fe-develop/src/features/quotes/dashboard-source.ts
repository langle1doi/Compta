import { formatEuro, formatPercent } from "@/lib/money";
import type { PipelineStage, Quote, QuoteStatusKey } from "@/mocks/dashboard/types";

import { quoteTotals, type QuoteRecord } from "./model";
import { owners, seedCustomers } from "./seed";
import { QUOTE_STATUS_ORDER, quoteStatusTone } from "./status";

const PIPELINE_COLORS: Record<(typeof QUOTE_STATUS_ORDER)[number], string> = {
  draft: "#d8dfeb",
  sent: "#4f86f3",
  review: "#f1b86b",
  accepted: "#4eb489",
  rejected: "#e7a8a2",
  expired: "#c5ceda",
};

const OPEN_STATUSES: QuoteRecord["status"][] = ["draft", "sent", "review"];

export function buildQuotePipeline(quotes: QuoteRecord[]): PipelineStage[] {
  return QUOTE_STATUS_ORDER.map((status) => {
    const items = quotes.filter((quote) => quote.status === status);
    const ttcCents = items.reduce((sum, quote) => sum + quoteTotals(quote).ttcCents, 0);
    return {
      labelKey: `status.${status}` as PipelineStage["labelKey"],
      value: formatEuro(Math.round(ttcCents / 100)),
      count: items.length,
      color: PIPELINE_COLORS[status],
    };
  });
}

export function buildPipelineSummary(quotes: QuoteRecord[]) {
  const openCents = quotes
    .filter((quote) => OPEN_STATUSES.includes(quote.status))
    .reduce((sum, quote) => sum + quoteTotals(quote).ttcCents, 0);
  const accepted = quotes.filter((quote) => quote.status === "accepted").length;
  const rejected = quotes.filter((quote) => quote.status === "rejected").length;
  const decided = accepted + rejected;

  return {
    openValue: formatEuro(Math.round(openCents / 100)),
    closeRate: formatPercent(decided === 0 ? 0 : accepted / decided),
  };
}

export function buildRecentQuotes(
  quotes: QuoteRecord[],
  customers = seedCustomers,
): Quote[] {
  return [...quotes]
    .sort((left, right) => right.id.localeCompare(left.id))
    .map((quote) => ({
      id: quote.id,
      customer:
        customers.find((customer) => customer.id === quote.customerId)?.name ??
        quote.customerId,
      workKey: quote.workKey,
      owner: owners.find((owner) => owner.id === quote.ownerId)?.initials ?? "",
      amount: formatEuro(Math.round(quoteTotals(quote).ttcCents / 100)),
      statusKey: `status.${quote.status}` as QuoteStatusKey,
      tone: quoteStatusTone[quote.status],
    }));
}

export function filterRecentQuotes(quotes: Quote[], statusIndex: number) {
  if (statusIndex <= 0) return quotes;
  const keys: QuoteStatusKey[] = [
    "status.draft",
    "status.sent",
    "status.review",
    "status.accepted",
  ];
  const key = keys[statusIndex - 1];
  if (!key) return quotes;
  return quotes.filter((quote) => quote.statusKey === key);
}
