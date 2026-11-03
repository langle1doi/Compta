import { owners, seedCustomers } from "./seed";
import {
  ledgerToday,
  quoteTotals,
  type CustomerRecord,
  type QuoteFilters,
  type QuoteRecord,
  type QuoteSort,
} from "./model";

function day(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

export function customerName(customers: CustomerRecord[], id: string) {
  return customers.find((customer) => customer.id === id)?.name ?? id;
}

export function ownerById(id: string) {
  return owners.find((owner) => owner.id === id);
}

export function matchesFilters(
  quote: QuoteRecord,
  filters: QuoteFilters,
  customers: CustomerRecord[],
) {
  const totals = quoteTotals(quote);
  const name = customerName(customers, quote.customerId).toLowerCase();
  const owner = ownerById(quote.ownerId);
  const query = filters.query.trim().toLowerCase();

  if (query) {
    const haystack = `${quote.id} ${name} ${owner?.name ?? ""} ${quote.workKey}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filters.statuses.length > 0 && !filters.statuses.includes(quote.status)) return false;
  if (filters.ownerId && quote.ownerId !== filters.ownerId) return false;
  if (filters.customerId && quote.customerId !== filters.customerId) return false;
  if (filters.amountMinCents != null && totals.ttcCents < filters.amountMinCents) return false;
  if (filters.amountMaxCents != null && totals.ttcCents > filters.amountMaxCents) return false;

  const until = day(quote.validUntil);
  const today = day(ledgerToday);
  if (filters.datePreset === "month" && !quote.validUntil.startsWith("2026-10")) return false;
  if (filters.datePreset === "quarter") {
    const month = Number(quote.validUntil.slice(5, 7));
    if (month < 10 || month > 12) return false;
  }
  if (filters.datePreset === "next7") {
    const limit = today + 7 * 24 * 60 * 60 * 1000;
    if (until < today || until > limit) return false;
  }
  if (filters.datePreset === "overdue" && until >= today) return false;

  return true;
}

export function sortQuotes(
  quotes: QuoteRecord[],
  sort: QuoteSort,
  customers: CustomerRecord[],
) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...quotes].sort((left, right) => {
    if (sort.key === "total") {
      return (quoteTotals(left).ttcCents - quoteTotals(right).ttcCents) * direction;
    }
    if (sort.key === "customer") {
      return customerName(customers, left.customerId).localeCompare(
        customerName(customers, right.customerId),
        "fr",
      ) * direction;
    }
    if (sort.key === "status") {
      return left.status.localeCompare(right.status) * direction;
    }
    if (sort.key === "validUntil") {
      return (day(left.validUntil) - day(right.validUntil)) * direction;
    }
    return left.id.localeCompare(right.id) * direction;
  });
}

export function sameFilters(left: QuoteFilters, right: QuoteFilters) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export { seedCustomers };
