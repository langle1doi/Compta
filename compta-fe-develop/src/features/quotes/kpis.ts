import { formatMoneyFromCents, formatPercent } from "@/lib/money";

import { ledgerToday, quoteTotals, type QuoteRecord } from "./model";

export type QuoteKpis = {
  openQuotes: number;
  openDelta: number;
  awaitingApproval: number;
  awaitingDelta: number;
  acceptedThisMonth: number;
  acceptedDelta: number;
  acceptedDeltaRatio: number;
  quoteValueCents: number;
  quoteValueDeltaRatio: number;
};

const OPEN: QuoteRecord["status"][] = ["draft", "sent", "review"];

/** Prior-period mock baselines so KPI badges stay internally consistent. */
const PRIOR = {
  open: 12,
  awaiting: 3,
  accepted: 0,
  quoteValueCents: 112_357_16,
};

function isCurrentMonth(iso: string) {
  return iso.startsWith(ledgerToday.slice(0, 7));
}

export function getQuoteKpis(quotes: QuoteRecord[]): QuoteKpis {
  const openQuotes = quotes.filter((quote) => OPEN.includes(quote.status)).length;
  const awaitingApproval = quotes.filter((quote) => quote.status === "review").length;
  const acceptedThisMonth = quotes.filter(
    (quote) =>
      quote.status === "accepted" &&
      (isCurrentMonth(quote.createdAt) ||
        quote.activity.some(
          (item) => item.messageKey === "activity.quoteAccepted" && isCurrentMonth(item.at),
        )),
  ).length;
  const quoteValueCents = quotes
    .filter((quote) => OPEN.includes(quote.status))
    .reduce((sum, quote) => sum + quoteTotals(quote).ttcCents, 0);

  return {
    openQuotes,
    openDelta: openQuotes - PRIOR.open,
    awaitingApproval,
    awaitingDelta: awaitingApproval - PRIOR.awaiting,
    acceptedThisMonth,
    acceptedDelta: acceptedThisMonth - PRIOR.accepted,
    quoteValueCents,
    quoteValueDeltaRatio:
      PRIOR.quoteValueCents === 0
        ? 0
        : quoteValueCents / PRIOR.quoteValueCents - 1,
    acceptedDeltaRatio:
      PRIOR.accepted === 0 ? 0 : acceptedThisMonth / PRIOR.accepted - 1,
  };
}

export function formatDelta(delta: number) {
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : String(delta);
}

export function formatValueDelta(ratio: number) {
  const sign = ratio >= 0 ? "+" : "";
  return `${sign}${formatPercent(ratio)}`;
}

export function formatQuoteValue(cents: number) {
  return formatMoneyFromCents(cents);
}
