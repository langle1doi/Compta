import {
  invoiceDisplayNumber,
  isInvoiceEligibleForPayment,
  type BankTransaction,
  type InvoicePayment,
  type InvoicePaymentMethod,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { ledgerToday } from "@/features/quotes/model";

import {
  PAYMENT_METHOD_ORDER,
  paymentListStatus,
  type PaymentFilters,
  type PaymentSortPreset,
} from "./model";

export function paymentsForCompany(
  payments: InvoicePayment[],
  invoices: InvoiceRecord[],
  companyId: string,
) {
  const allowed = new Set(
    invoices.filter((invoice) => invoice.companyId === companyId).map((invoice) => invoice.id),
  );
  return payments.filter((payment) => allowed.has(payment.invoiceId));
}

export function invoicesForCompany(invoices: InvoiceRecord[], companyId: string) {
  return invoices.filter((invoice) => invoice.companyId === companyId);
}

export function bankTransactionsForCompany(
  transactions: BankTransaction[],
  companyId: string,
) {
  return transactions.filter((item) => item.companyId === companyId);
}

export function unmatchedBankTransactions(transactions: BankTransaction[]) {
  return transactions.filter((item) => item.status !== "matched");
}

export { pendingBankTransactions, previewBankTransactions } from "./reconciliation";

export function eligibleInvoicesForPayment(
  invoices: InvoiceRecord[],
  payments: InvoicePayment[],
  companyId: string,
) {
  return invoicesForCompany(invoices, companyId).filter((invoice) =>
    isInvoiceEligibleForPayment(invoice, payments),
  );
}

export function methodsInUse(payments: InvoicePayment[]): InvoicePaymentMethod[] {
  const used = new Set(payments.map((payment) => payment.method));
  return PAYMENT_METHOD_ORDER.filter((method) => used.has(method));
}

export function matchesPaymentFilters(
  payment: InvoicePayment,
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
  filters: PaymentFilters,
) {
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [
      payment.reference,
      payment.externalReference ?? "",
      payment.bankReference ?? "",
      payment.bankTransactionId ?? "",
      invoice?.customerName ?? "",
      invoice ? invoiceDisplayNumber(invoice) : "",
      invoice?.number ?? "",
      invoice?.reference ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (filters.status !== "all" && paymentListStatus(payment, invoice, payments) !== filters.status) {
    return false;
  }
  if (filters.method !== "all" && payment.method !== filters.method) return false;
  if (filters.customerId && invoice?.customerId !== filters.customerId) return false;
  if (filters.invoiceId && payment.invoiceId !== filters.invoiceId) return false;
  if (filters.reconciliation !== "all" && payment.reconciliationStatus !== filters.reconciliation) {
    return false;
  }
  if (filters.datePreset === "month" && !payment.date.startsWith(ledgerToday.slice(0, 7))) {
    return false;
  }
  if (filters.datePreset === "quarter") {
    const month = Number(payment.date.slice(5, 7));
    if (month < 10 || month > 12) return false;
  }

  return true;
}

export function sortPayments(payments: InvoicePayment[], preset: PaymentSortPreset) {
  const copy = [...payments];
  copy.sort((left, right) => {
    if (preset === "highest") return right.amountCents - left.amountCents;
    if (preset === "lowest") return left.amountCents - right.amountCents;
    const leftTime = `${left.date}${left.id}`;
    const rightTime = `${right.date}${right.id}`;
    return preset === "oldest" ? leftTime.localeCompare(rightTime) : rightTime.localeCompare(leftTime);
  });
  return copy;
}
