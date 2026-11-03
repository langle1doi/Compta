import { ledgerToday, type QuoteRecord } from "@/features/quotes/model";
import { owners } from "@/features/quotes/seed";

import {
  derivePaymentStatus,
  invoiceDisplayNumber,
  invoiceListStatus,
  invoiceTotals,
  isInvoiceLocked,
  type InvoiceFilters,
  type InvoicePayment,
  type InvoiceRecord,
  type InvoiceSortPreset,
} from "./model";

export function invoiceOwnerById(id: string) {
  return owners.find((owner) => owner.id === id);
}

export function isQuoteConvertible(quote: QuoteRecord, invoices: InvoiceRecord[]) {
  if (quote.status !== "accepted") return false;
  return !invoices.some((invoice) => invoice.quoteId === quote.id && isInvoiceLocked(invoice));
}

export function existingDraftForQuote(quoteId: string, invoices: InvoiceRecord[]) {
  return (
    invoices.find(
      (invoice) => invoice.quoteId === quoteId && (invoice.status === "draft" || invoice.status === "to_validate"),
    ) ?? null
  );
}

export function matchesInvoiceFilters(
  invoice: InvoiceRecord,
  filters: InvoiceFilters,
  payments: InvoicePayment[],
) {
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [
      invoiceDisplayNumber(invoice),
      invoice.number ?? "",
      invoice.temporaryNumber,
      invoice.customerName,
      invoice.quoteId,
      invoice.poNumber ?? "",
      invoice.reference ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (filters.status !== "all") {
    const documentMatch = invoice.status === filters.status;
    const paymentMatch = derivePaymentStatus(invoice, payments, ledgerToday) === filters.status;
    const listMatch = invoiceListStatus(invoice, payments, ledgerToday) === filters.status;
    if (!documentMatch && !paymentMatch && !listMatch) return false;
  }

  if (filters.customerId && invoice.customerId !== filters.customerId) return false;
  if (filters.ownerId && invoice.ownerId !== filters.ownerId) return false;

  if (filters.datePreset === "month" && !invoice.issueDate.startsWith(ledgerToday.slice(0, 7))) {
    return false;
  }
  if (filters.datePreset === "quarter") {
    const month = Number(invoice.issueDate.slice(5, 7));
    if (month < 10 || month > 12) return false;
  }
  if (filters.datePreset === "overdue") {
    if (derivePaymentStatus(invoice, payments, ledgerToday) !== "overdue") return false;
  }

  return true;
}

export function sortInvoices(
  invoices: InvoiceRecord[],
  preset: InvoiceSortPreset,
  payments: InvoicePayment[],
) {
  const copy = [...invoices];
  copy.sort((left, right) => {
    if (preset === "oldest") return left.createdAt.localeCompare(right.createdAt);
    if (preset === "dueSoon") return left.dueDate.localeCompare(right.dueDate);
    if (preset === "highest") {
      return invoiceTotals(right).ttcCents - invoiceTotals(left).ttcCents;
    }
    if (preset === "lowest") {
      return invoiceTotals(left).ttcCents - invoiceTotals(right).ttcCents;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
  void payments;
  return copy;
}
