import {
  paidCentsFor,
  remainingCentsFor,
  type InvoicePayment,
  type InvoicePaymentMethod,
  type InvoiceRecord,
  type PaymentReconciliationStatus,
} from "@/features/invoices/model";
import { ledgerToday } from "@/features/quotes/model";

/** Invoice collection status shown in the payment list Status column (not reconciliation). */
export type PaymentListStatus = "paid" | "partial" | "unpaid" | "overdue";

export type PaymentNextAction = "view" | "record" | "follow_up";

export type PaymentSortPreset = "newest" | "oldest" | "highest" | "lowest";

export type PaymentFilters = {
  query: string;
  status: PaymentListStatus | "all";
  method: InvoicePaymentMethod | "all";
  customerId: string | null;
  invoiceId: string | null;
  datePreset: "any" | "month" | "quarter";
  reconciliation: PaymentReconciliationStatus | "all";
};

export const emptyPaymentFilters: PaymentFilters = {
  query: "",
  status: "all",
  method: "all",
  customerId: null,
  invoiceId: null,
  datePreset: "any",
  reconciliation: "all",
};

export const PAYMENT_STATUS_FILTERS: Array<PaymentListStatus | "all"> = [
  "all",
  "paid",
  "partial",
  "unpaid",
  "overdue",
];

export function completedPaymentCount(invoiceId: string, payments: InvoicePayment[]) {
  return payments.filter(
    (payment) => payment.invoiceId === invoiceId && payment.status === "completed",
  ).length;
}

export function collectionStatus(
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
): PaymentListStatus {
  if (!invoice) return "paid";
  const remaining = remainingCentsFor(invoice, payments);
  const paid = paidCentsFor(invoice.id, payments);
  if (remaining <= 0) return "paid";
  if (invoice.dueDate < ledgerToday) return "overdue";
  if (paid > 0) return "partial";
  return "unpaid";
}

export const PAYMENT_METHOD_ORDER: InvoicePaymentMethod[] = [
  "transfer",
  "card",
  "direct_debit",
  "cash",
  "check",
];

export function paymentListStatus(
  _payment: InvoicePayment,
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
): PaymentListStatus {
  return collectionStatus(invoice, payments);
}

export function paymentNextAction(
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
): PaymentNextAction {
  if (!invoice) return "view";
  const remaining = remainingCentsFor(invoice, payments);
  if (remaining <= 0) return "view";
  // Overdue (including partial + overdue) → collection follow-up, not record payment.
  if (invoice.dueDate < ledgerToday) return "follow_up";
  return "record";
}

export function nextActionCopy(
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
): { key: "view" | "record" | "recordNth" | "followUp"; values?: { n: number } } {
  const next = paymentNextAction(invoice, payments);
  if (next === "view") return { key: "view" };
  if (next === "follow_up") return { key: "followUp" };
  const n = invoice ? completedPaymentCount(invoice.id, payments) + 1 : 1;
  if (n > 1) return { key: "recordNth", values: { n } };
  return { key: "record" };
}

export function invoiceRemaining(invoice: InvoiceRecord, payments: InvoicePayment[]) {
  return remainingCentsFor(invoice, payments);
}
