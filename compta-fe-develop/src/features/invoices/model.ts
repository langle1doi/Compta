import type { PaymentTerms } from "@/features/customers/types";
import { quoteTotals, type QuoteLine, type WorkKey } from "@/features/quotes/model";
import { addDaysToIso } from "@/lib/iso-date";

export type InvoiceDocumentStatus = "draft" | "to_validate" | "validated" | "sent";

export type InvoicePaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

export type InvoiceLine = QuoteLine & {
  vatRate?: number;
};

export type InvoiceActivityKind =
  | "created"
  | "updated"
  | "validated"
  | "sent"
  | "payment";

export type InvoiceActivity = {
  id: string;
  at: string;
  kind: InvoiceActivityKind;
  actorName: string;
  quoteId?: string;
};

export type InvoicePaymentMethod = "transfer" | "check" | "card" | "direct_debit" | "cash";

export type PaymentReconciliationStatus = "matched" | "to_match";

export type InvoicePayment = {
  id: string;
  invoiceId: string;
  reference: string;
  date: string;
  amountCents: number;
  method: InvoicePaymentMethod;
  /** Money-movement lifecycle — not the invoice collection status (unpaid/partial/paid/overdue). */
  status: "completed" | "pending" | "failed";
  reconciliationStatus: PaymentReconciliationStatus;
  notes?: string;
  bankTransactionId?: string;
  bankReference?: string;
  /** Optional free-text remittance / payer reference (not the PAY-xxxx id). */
  externalReference?: string;
  createdAt?: string;
  createdBy?: string;
};

/** Mock imported bank lines — not an Open Banking / AI matching integration. */
export type BankTransactionStatus =
  | "unmatched"
  | "matched"
  | "needs_review"
  | "cannot_match";

export type BankMatchReasonCode =
  | "amount_exact"
  | "amount_partial"
  | "amount_mismatch"
  | "amount_exceeds"
  | "invoice_number_found"
  | "customer_name_match"
  | "customer_name_uncertain"
  | "no_invoice_reference"
  | "partial_payment_candidate";

export type BankTransaction = {
  id: string;
  amountCents: number;
  date: string;
  label: string;
  companyId: string;
  status: BankTransactionStatus;
  suggestedInvoiceId?: string;
  matchedInvoiceId?: string;
  matchedPaymentId?: string;
  reference?: string;
  sourceAccount?: string;
  /** 0–100 heuristic confidence for demo suggestions — not live Open Banking AI. */
  matchConfidence?: number;
  matchReasons?: BankMatchReasonCode[];
};

export type PaymentActivityKind =
  | "recorded"
  | "matched"
  | "invoice_paid"
  | "invoice_partial"
  | "reviewed";

export type PaymentActivity = {
  id: string;
  at: string;
  kind: PaymentActivityKind;
  actorName: string;
  paymentId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  bankTransactionId?: string;
  amountCents?: number;
  customerName?: string;
};

export type InvoiceRecord = {
  id: string;
  number?: string;
  temporaryNumber: string;
  quoteId: string;
  customerId: string;
  customerName: string;
  ownerId: string;
  companyId: string;
  workKey: WorkKey;
  status: InvoiceDocumentStatus;
  paymentStatus: InvoicePaymentStatus;
  currency: string;
  vatRate: number;
  lines: InvoiceLine[];
  issueDate: string;
  dueDate: string;
  paymentTerms: PaymentTerms;
  poNumber?: string;
  reference?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
  activity: InvoiceActivity[];
};

export type InvoiceDraftPatch = Pick<
  InvoiceRecord,
  | "issueDate"
  | "dueDate"
  | "paymentTerms"
  | "poNumber"
  | "reference"
  | "lines"
  | "customerId"
  | "customerName"
  | "currency"
>;

export type InvoiceFilters = {
  query: string;
  status: InvoiceListStatusFilter;
  customerId: string | null;
  ownerId: string | null;
  datePreset: "any" | "month" | "quarter" | "overdue";
};

export type InvoiceListStatusFilter =
  | "all"
  | InvoiceDocumentStatus
  | InvoicePaymentStatus;

export type InvoiceSortPreset = "newest" | "oldest" | "dueSoon" | "highest" | "lowest";

export const emptyInvoiceFilters: InvoiceFilters = {
  query: "",
  status: "all",
  customerId: null,
  ownerId: null,
  datePreset: "any",
};

export const PAYMENT_TERM_DAYS: Record<PaymentTerms, number> = {
  upon_receipt: 0,
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
};

export function calculateDueDate(issueDate: string, paymentTerms: PaymentTerms) {
  return addDaysToIso(issueDate, PAYMENT_TERM_DAYS[paymentTerms]);
}

export function invoiceTotals(invoice: Pick<InvoiceRecord, "id" | "customerId" | "workKey" | "ownerId" | "dueDate" | "vatRate" | "lines" | "issueDate">) {
  return quoteTotals({
    id: invoice.id,
    customerId: invoice.customerId,
    workKey: invoice.workKey,
    ownerId: invoice.ownerId,
    status: "accepted",
    validUntil: invoice.dueDate,
    vatRate: invoice.vatRate,
    lines: invoice.lines,
    activity: [],
    createdAt: invoice.issueDate,
  });
}

export function invoiceVatBreakdown(invoice: InvoiceRecord) {
  const groups = new Map<number, { htCents: number; vatCents: number }>();
  for (const line of invoice.lines) {
    const rate = line.vatRate ?? invoice.vatRate;
    const htCents = line.qty * line.unitHtCents;
    const current = groups.get(rate) ?? { htCents: 0, vatCents: 0 };
    current.htCents += htCents;
    current.vatCents += Math.round((htCents * rate) / 100);
    groups.set(rate, current);
  }
  return [...groups.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([rate, amounts]) => ({ rate, ...amounts }));
}

export function isInvoiceLocked(invoice: InvoiceRecord) {
  return invoice.status === "validated" || invoice.status === "sent" || Boolean(invoice.lockedAt);
}

export function invoiceDisplayNumber(invoice: InvoiceRecord) {
  return invoice.number ?? invoice.temporaryNumber;
}

export function paidCentsFor(invoiceId: string, payments: InvoicePayment[]) {
  return payments
    .filter((payment) => payment.invoiceId === invoiceId && payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
}

export function remainingCentsFor(invoice: InvoiceRecord, payments: InvoicePayment[]) {
  return Math.max(0, invoiceTotals(invoice).ttcCents - paidCentsFor(invoice.id, payments));
}

export function isInvoiceEligibleForPayment(invoice: InvoiceRecord, payments: InvoicePayment[]) {
  return isInvoiceLocked(invoice) && remainingCentsFor(invoice, payments) > 0;
}

export function derivePaymentStatus(
  invoice: InvoiceRecord,
  payments: InvoicePayment[],
  today: string,
): InvoicePaymentStatus {
  if (!isInvoiceLocked(invoice)) return "unpaid";
  const total = invoiceTotals(invoice).ttcCents;
  const paid = paidCentsFor(invoice.id, payments);
  if (total > 0 && paid >= total) return "paid";
  if (paid > 0) return "partial";
  if (invoice.dueDate < today) return "overdue";
  return "unpaid";
}

export function invoiceListStatus(
  invoice: InvoiceRecord,
  payments: InvoicePayment[],
  today: string,
): InvoiceListStatusFilter {
  if (invoice.status === "draft" || invoice.status === "to_validate") return invoice.status;
  return derivePaymentStatus(invoice, payments, today);
}

export function nextInvoiceAction(
  invoice: InvoiceRecord,
  payments: InvoicePayment[],
  today: string,
): "edit" | "validate" | "view" | "followUp" {
  if (invoice.status === "draft") return "edit";
  if (invoice.status === "to_validate") return "validate";
  const remaining = remainingCentsFor(invoice, payments);
  if (remaining <= 0) return "view";
  // Partial + overdue still follows up — ask for the remainder before recording cash.
  if (invoice.dueDate < today) return "followUp";
  return "view";
}

export function parseOfficialInvoiceSequence(number: string | undefined) {
  if (!number) return 0;
  const value = Number(number.replace(/\D/g, ""));
  return Number.isFinite(value) ? value : 0;
}
