"use client";

import { useSyncExternalStore } from "react";

import { ledgerToday, type QuoteRecord } from "@/features/quotes/model";
import { getCurrentCompanyId } from "@/features/settings/company-store";
import { mockCompanies } from "@/features/settings/mocks/companies";

import {
  calculateDueDate,
  derivePaymentStatus,
  invoiceDisplayNumber,
  isInvoiceEligibleForPayment,
  isInvoiceLocked,
  paidCentsFor,
  parseOfficialInvoiceSequence,
  remainingCentsFor,
  type BankTransaction,
  type InvoiceDraftPatch,
  type InvoicePayment,
  type InvoicePaymentMethod,
  type InvoiceRecord,
  type PaymentActivity,
} from "./model";
import { existingDraftForQuote, isQuoteConvertible } from "./query";
import { seedBankTransactions, seedInvoices, seedPaymentActivities, seedPayments } from "./seed";

type InvoiceState = {
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  bankTransactions: BankTransaction[];
  paymentActivities: PaymentActivity[];
};

const serverState: InvoiceState = {
  invoices: seedInvoices,
  payments: seedPayments,
  bankTransactions: seedBankTransactions,
  paymentActivities: seedPaymentActivities,
};

let state: InvoiceState = serverState;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function nextOfficialNumber(invoices: InvoiceRecord[]) {
  const numeric = invoices.reduce(
    (max, invoice) => Math.max(max, parseOfficialInvoiceSequence(invoice.number)),
    20260017,
  );
  return `FAC${numeric + 1}`;
}

function nextDraftNumber(invoices: InvoiceRecord[]) {
  const numeric = invoices.reduce((max, invoice) => {
    const match = /DRAFT-2026-(\d+)/.exec(invoice.temporaryNumber);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `DRAFT-2026-${String(numeric + 1).padStart(3, "0")}`;
}

function stamp() {
  return `${ledgerToday}T12:00:00.000Z`;
}

function withDerivedPayment(invoice: InvoiceRecord, payments: InvoicePayment[]): InvoiceRecord {
  return {
    ...invoice,
    paymentStatus: derivePaymentStatus(invoice, payments, ledgerToday),
  };
}

export function useInvoiceState() {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

export function useInvoices() {
  return useInvoiceState().invoices;
}

export function useInvoicePayments() {
  return useInvoiceState().payments;
}

export function useBankTransactions() {
  return useInvoiceState().bankTransactions;
}

export function usePaymentActivities() {
  return useInvoiceState().paymentActivities;
}

export function getInvoiceById(id: string) {
  const invoice = state.invoices.find((item) => item.id === id);
  return invoice ? withDerivedPayment(invoice, state.payments) : null;
}

export function paymentsForInvoice(invoiceId: string) {
  return state.payments.filter((payment) => payment.invoiceId === invoiceId);
}

export function createInvoiceFromQuote(
  quote: QuoteRecord,
  customerName: string,
): InvoiceRecord | null {
  if (quote.status !== "accepted") return null;
  const existingDraft = existingDraftForQuote(quote.id, state.invoices);
  if (existingDraft) return withDerivedPayment(existingDraft, state.payments);
  if (!isQuoteConvertible(quote, state.invoices)) return null;

  const company = mockCompanies.find((item) => item.id === getCurrentCompanyId());
  const issueDate = ledgerToday;
  const paymentTerms = "net_30" as const;
  const now = stamp();
  const invoice: InvoiceRecord = {
    id: `inv-${quote.id}`,
    temporaryNumber: nextDraftNumber(state.invoices),
    quoteId: quote.id,
    customerId: quote.customerId,
    customerName,
    ownerId: quote.ownerId,
    companyId: company?.id ?? "co-dfm-europe",
    workKey: quote.workKey,
    status: "draft",
    paymentStatus: "unpaid",
    currency: company?.currency ?? "EUR",
    vatRate: quote.vatRate,
    lines: quote.lines.map((line, index) => ({ ...line, id: `${quote.id}-inv-${index}` })),
    issueDate,
    dueDate: calculateDueDate(issueDate, paymentTerms),
    paymentTerms,
    reference: undefined,
    createdAt: now,
    updatedAt: now,
    activity: [
      {
        id: `${quote.id}-created-${Date.now()}`,
        at: now,
        kind: "created",
        actorName: "You",
        quoteId: quote.id,
      },
    ],
  };
  state = { ...state, invoices: [invoice, ...state.invoices] };
  emit();
  return invoice;
}

export function updateInvoice(id: string, patch: Partial<InvoiceDraftPatch>): boolean {
  const current = state.invoices.find((invoice) => invoice.id === id);
  if (!current) return false;

  const patchKeys = (Object.keys(patch) as Array<keyof InvoiceDraftPatch>).filter(
    (key) => patch[key] !== undefined,
  );
  const currencyOnly = patchKeys.length > 0 && patchKeys.every((key) => key === "currency");

  // Locked invoices stay immutable except currency ( SoftSelect in details ).
  if (isInvoiceLocked(current) && !currencyOnly) return false;

  const nextTerms = patch.paymentTerms ?? current.paymentTerms;
  const nextIssue = patch.issueDate ?? current.issueDate;
  const dueDate = isInvoiceLocked(current)
    ? current.dueDate
    : patch.dueDate ??
      (patch.issueDate || patch.paymentTerms ? calculateDueDate(nextIssue, nextTerms) : current.dueDate);

  const updated: InvoiceRecord = {
    ...current,
    ...patch,
    dueDate,
    updatedAt: stamp(),
    activity: [
      {
        id: `${id}-updated-${Date.now()}`,
        at: stamp(),
        kind: "updated",
        actorName: "You",
      },
      ...current.activity,
    ],
  };

  state = {
    ...state,
    invoices: state.invoices.map((invoice) => (invoice.id === id ? updated : invoice)),
  };
  emit();
  return true;
}

export function validateInvoice(id: string): boolean {
  const current = state.invoices.find((invoice) => invoice.id === id);
  if (!current || isInvoiceLocked(current)) return false;
  if (current.status !== "draft" && current.status !== "to_validate") return false;

  const now = stamp();
  const number = nextOfficialNumber(state.invoices);
  const updated: InvoiceRecord = {
    ...current,
    number,
    status: "validated",
    lockedAt: now,
    updatedAt: now,
    paymentStatus: derivePaymentStatus(
      { ...current, status: "validated", lockedAt: now, number },
      state.payments,
      ledgerToday,
    ),
    activity: [
      {
        id: `${id}-validated-${Date.now()}`,
        at: now,
        kind: "validated",
        actorName: "You",
      },
      ...current.activity,
    ],
  };

  state = {
    ...state,
    invoices: state.invoices.map((invoice) => (invoice.id === id ? updated : invoice)),
  };
  emit();
  return true;
}

export function markInvoiceSent(id: string): boolean {
  const current = state.invoices.find((invoice) => invoice.id === id);
  if (!current || !isInvoiceLocked(current)) return false;
  const now = stamp();
  state = {
    ...state,
    invoices: state.invoices.map((invoice) =>
      invoice.id === id
        ? {
            ...invoice,
            status: "sent",
            updatedAt: now,
            activity: [
              {
                id: `${id}-sent-${Date.now()}`,
                at: now,
                kind: "sent",
                actorName: "You",
              },
              ...invoice.activity,
            ],
          }
        : invoice,
    ),
  };
  emit();
  return true;
}

export function deleteInvoice(id: string): boolean {
  const current = state.invoices.find((invoice) => invoice.id === id);
  if (!current || isInvoiceLocked(current)) return false;
  state = {
    ...state,
    invoices: state.invoices.filter((invoice) => invoice.id !== id),
  };
  emit();
  return true;
}

export type RecordPaymentInput = {
  invoiceId: string;
  amountCents: number;
  date: string;
  method: InvoicePaymentMethod;
  reference?: string;
  bankReference?: string;
  notes?: string;
  bankTransactionId?: string;
  actorName?: string;
};

export type LedgerMutationError =
  | "not_found"
  | "not_eligible"
  | "overpayment"
  | "invalid_amount"
  | "already_matched";

export type LedgerMutationResult =
  | { ok: true; payment: InvoicePayment }
  | { ok: false; error: LedgerMutationError };

function nextPaymentReference(payments: InvoicePayment[]) {
  const numeric = payments.reduce((max, payment) => {
    const match = /PAY-2026-(\d+)/.exec(payment.reference);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 41);
  return `PAY-2026-${String(numeric + 1).padStart(4, "0")}`;
}

function refreshInvoices(invoices: InvoiceRecord[], payments: InvoicePayment[]) {
  return invoices.map((invoice) => withDerivedPayment(invoice, payments));
}

function appendPaymentActivity(
  activities: PaymentActivity[],
  item: Omit<PaymentActivity, "id"> & { id?: string },
): PaymentActivity[] {
  const activity: PaymentActivity = {
    ...item,
    id: item.id ?? `pa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  return [activity, ...activities];
}

export function recordPayment(
  input: RecordPaymentInput,
  options?: { silent?: boolean },
): LedgerMutationResult {
  const invoice = state.invoices.find((item) => item.id === input.invoiceId);
  if (!invoice) return { ok: false, error: "not_found" };
  if (!isInvoiceEligibleForPayment(invoice, state.payments)) {
    return { ok: false, error: "not_eligible" };
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  const remaining = remainingCentsFor(invoice, state.payments);
  if (input.amountCents > remaining) return { ok: false, error: "overpayment" };

  const now = stamp();
  const actorName = input.actorName ?? "You";
  const payment: InvoicePayment = {
    id: `pay-${Date.now()}`,
    invoiceId: invoice.id,
    reference: nextPaymentReference(state.payments),
    date: input.date,
    amountCents: input.amountCents,
    method: input.method,
    status: "completed",
    reconciliationStatus: "matched",
    notes: input.notes?.trim() || undefined,
    bankTransactionId: input.bankTransactionId,
    bankReference: input.bankReference?.trim() || undefined,
    externalReference: input.reference?.trim() || undefined,
    createdAt: now,
    createdBy: actorName,
  };

  const payments = [payment, ...state.payments];
  const becamePaid = remainingCentsFor(invoice, payments) === 0;
  const becamePartial = !becamePaid && paidCentsFor(invoice.id, payments) > 0;
  const invoices = refreshInvoices(
    state.invoices.map((item) =>
      item.id === invoice.id
        ? {
            ...item,
            updatedAt: now,
            activity: [
              {
                id: `${invoice.id}-payment-${Date.now()}`,
                at: now,
                kind: "payment" as const,
                actorName,
              },
              ...item.activity,
            ],
          }
        : item,
    ),
    payments,
  );

  let activities = appendPaymentActivity(state.paymentActivities, {
    at: now,
    kind: "recorded",
    actorName,
    paymentId: payment.id,
    invoiceId: invoice.id,
    invoiceNumber: invoiceDisplayNumber(invoice),
    amountCents: payment.amountCents,
    customerName: invoice.customerName,
    bankTransactionId: payment.bankTransactionId,
  });
  if (becamePaid) {
    activities = appendPaymentActivity(activities, {
      at: now,
      kind: "invoice_paid",
      actorName,
      paymentId: payment.id,
      invoiceId: invoice.id,
      invoiceNumber: invoiceDisplayNumber(invoice),
      amountCents: payment.amountCents,
      customerName: invoice.customerName,
    });
  } else if (becamePartial) {
    activities = appendPaymentActivity(activities, {
      at: now,
      kind: "invoice_partial",
      actorName,
      paymentId: payment.id,
      invoiceId: invoice.id,
      invoiceNumber: invoiceDisplayNumber(invoice),
      amountCents: payment.amountCents,
      customerName: invoice.customerName,
    });
  }

  state = { ...state, invoices, payments, paymentActivities: activities };
  if (!options?.silent) emit();
  return { ok: true, payment };
}

/** Mark a failed suggestion as not reviewable (cannot match). */
export function clearBankMatchSuggestion(bankTransactionId: string): boolean {
  const transaction = state.bankTransactions.find((item) => item.id === bankTransactionId);
  if (!transaction || transaction.status === "matched") return false;

  state = {
    ...state,
    bankTransactions: state.bankTransactions.map((item) =>
      item.id === bankTransactionId
        ? {
            ...item,
            status: "cannot_match" as const,
            suggestedInvoiceId: undefined,
            matchConfidence: undefined,
            matchReasons: undefined,
          }
        : item,
    ),
  };
  emit();
  return true;
}

export function matchBankTransaction(
  bankTransactionId: string,
  invoiceId: string,
  options?: { manualReview?: boolean },
): LedgerMutationResult {
  const transaction = state.bankTransactions.find((item) => item.id === bankTransactionId);
  if (!transaction) return { ok: false, error: "not_found" };
  if (transaction.status === "matched") return { ok: false, error: "already_matched" };

  const recorded = recordPayment(
    {
      invoiceId,
      amountCents: transaction.amountCents,
      date: transaction.date,
      method: "transfer",
      bankTransactionId: transaction.id,
      bankReference: transaction.label,
      actorName: "You",
    },
    { silent: true },
  );
  if (!recorded.ok) return recorded;

  const now = stamp();
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  const bankTransactions = state.bankTransactions.map((item) =>
    item.id === bankTransactionId
      ? {
          ...item,
          status: "matched" as const,
          matchedInvoiceId: invoiceId,
          matchedPaymentId: recorded.payment.id,
        }
      : item,
  );
  const paymentActivities = appendPaymentActivity(state.paymentActivities, {
    at: now,
    kind: options?.manualReview ? "reviewed" : "matched",
    actorName: "You",
    paymentId: recorded.payment.id,
    invoiceId,
    invoiceNumber: invoice ? invoiceDisplayNumber(invoice) : undefined,
    bankTransactionId,
    amountCents: transaction.amountCents,
    customerName: invoice?.customerName,
  });

  state = { ...state, bankTransactions, paymentActivities };
  emit();
  return recorded;
}
