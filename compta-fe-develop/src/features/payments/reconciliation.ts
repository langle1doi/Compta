import {
  invoiceDisplayNumber,
  remainingCentsFor,
  type BankMatchReasonCode,
  type BankTransaction,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { ledgerToday } from "@/features/quotes/model";
import { formatMoneyFromCents } from "@/lib/money";

/** Accountant-facing queue status (derived; may refine raw bank status). */
export type ReconciliationQueueStatus =
  | "suggested_match"
  | "needs_review"
  | "matched"
  | "unmatched"
  | "cannot_match";

export type ReconciliationAmountFilter =
  | "all"
  | "exact_match"
  | "partial_match"
  | "amount_mismatch";

export type ReconciliationPeriodFilter = "any" | "month" | "last_month";

export type ReconciliationConfidenceFilter = "all" | "high" | "medium" | "low";

export type ReconciliationSortPreset =
  | "newest"
  | "oldest"
  | "highest"
  | "lowest"
  | "confidence_high"
  | "confidence_low"
  | "closest_amount";

export type ReconciliationFilters = {
  query: string;
  status: ReconciliationQueueStatus | "all";
  period: ReconciliationPeriodFilter;
  amount: ReconciliationAmountFilter;
  confidence: ReconciliationConfidenceFilter;
  sort: ReconciliationSortPreset;
};

export const emptyReconciliationFilters: ReconciliationFilters = {
  query: "",
  status: "all",
  period: "any",
  amount: "all",
  confidence: "all",
  sort: "newest",
};

export const RECONCILIATION_STATUS_FILTERS: Array<ReconciliationQueueStatus | "all"> = [
  "all",
  "suggested_match",
  "needs_review",
  "unmatched",
  "cannot_match",
];

export const RECONCILIATION_PERIOD_FILTERS: ReconciliationPeriodFilter[] = [
  "any",
  "month",
  "last_month",
];

export const RECONCILIATION_AMOUNT_FILTERS: ReconciliationAmountFilter[] = [
  "all",
  "exact_match",
  "partial_match",
  "amount_mismatch",
];

export const RECONCILIATION_CONFIDENCE_FILTERS: ReconciliationConfidenceFilter[] = [
  "all",
  "high",
  "medium",
  "low",
];

export const RECONCILIATION_SORT_PRESETS: ReconciliationSortPreset[] = [
  "newest",
  "oldest",
  "highest",
  "lowest",
  "confidence_high",
  "confidence_low",
  "closest_amount",
];

const PREVIEW_LIMIT = 15;

function previousMonthPrefix(today: string) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

export function computeMatchReasons(
  transaction: BankTransaction,
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
): BankMatchReasonCode[] {
  if (transaction.matchReasons && transaction.matchReasons.length > 0) {
    return transaction.matchReasons;
  }
  if (!invoice) {
    return ["no_invoice_reference", "customer_name_uncertain"];
  }

  const reasons: BankMatchReasonCode[] = [];
  const remaining = remainingCentsFor(invoice, payments);
  const label = transaction.label.toLowerCase();
  const invoiceNumber = invoiceDisplayNumber(invoice).toLowerCase();
  const customer = invoice.customerName.toLowerCase();

  if (label.includes(invoiceNumber.toLowerCase()) || label.includes(invoice.number?.toLowerCase() ?? "")) {
    reasons.push("invoice_number_found");
  } else {
    reasons.push("no_invoice_reference");
  }

  const customerToken = customer.split(/\s+/)[0] ?? "";
  if (customerToken && label.includes(customerToken)) {
    reasons.push("customer_name_match");
  } else {
    reasons.push("customer_name_uncertain");
  }

  if (transaction.amountCents === remaining) {
    reasons.push("amount_exact");
  } else if (transaction.amountCents > remaining) {
    reasons.push("amount_exceeds");
  } else if (transaction.amountCents > 0 && transaction.amountCents < remaining) {
    reasons.push("partial_payment_candidate");
    reasons.push("amount_partial");
  } else {
    reasons.push("amount_mismatch");
  }

  return reasons;
}

export function matchConfidenceFor(
  transaction: BankTransaction,
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
): number {
  if (typeof transaction.matchConfidence === "number") {
    return transaction.matchConfidence;
  }
  const reasons = computeMatchReasons(transaction, invoice, payments);
  let score = 40;
  if (reasons.includes("amount_exact")) score += 35;
  if (reasons.includes("partial_payment_candidate")) score += 15;
  if (reasons.includes("invoice_number_found")) score += 20;
  if (reasons.includes("customer_name_match")) score += 15;
  if (reasons.includes("amount_exceeds")) score -= 40;
  if (reasons.includes("customer_name_uncertain")) score -= 10;
  if (reasons.includes("no_invoice_reference")) score -= 10;
  if (!invoice) score = 15;
  return Math.max(0, Math.min(100, score));
}

export function deriveQueueStatus(
  transaction: BankTransaction,
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
): ReconciliationQueueStatus {
  if (transaction.status === "matched") return "matched";
  if (transaction.status === "cannot_match") return "cannot_match";
  if (transaction.status === "needs_review") return "needs_review";

  if (!transaction.suggestedInvoiceId || !invoice) return "unmatched";

  const remaining = remainingCentsFor(invoice, payments);
  if (transaction.amountCents > remaining) return "needs_review";

  const confidence = matchConfidenceFor(transaction, invoice, payments);
  if (confidence < 55) return "needs_review";

  return "suggested_match";
}

export function queueStatusPriority(status: ReconciliationQueueStatus): number {
  if (status === "needs_review") return 0;
  if (status === "suggested_match") return 1;
  if (status === "unmatched") return 2;
  if (status === "cannot_match") return 3;
  return 4;
}

export function pendingBankTransactions(transactions: BankTransaction[]) {
  return transactions.filter(
    (item) => item.status !== "matched" && item.status !== "cannot_match",
  );
}

export function previewBankTransactions(
  transactions: BankTransaction[],
  invoicesById: Map<string, InvoiceRecord>,
  payments: InvoicePayment[],
  limit = PREVIEW_LIMIT,
) {
  const pending = pendingBankTransactions(transactions);
  return [...pending]
    .sort((left, right) => {
      const leftInvoice = left.suggestedInvoiceId
        ? invoicesById.get(left.suggestedInvoiceId)
        : undefined;
      const rightInvoice = right.suggestedInvoiceId
        ? invoicesById.get(right.suggestedInvoiceId)
        : undefined;
      const leftStatus = deriveQueueStatus(left, leftInvoice, payments);
      const rightStatus = deriveQueueStatus(right, rightInvoice, payments);
      const byStatus = queueStatusPriority(leftStatus) - queueStatusPriority(rightStatus);
      if (byStatus !== 0) return byStatus;
      return `${right.date}${right.id}`.localeCompare(`${left.date}${left.id}`);
    })
    .slice(0, limit);
}

function amountRelation(
  transaction: BankTransaction,
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
): ReconciliationAmountFilter | "none" {
  if (!invoice) return "amount_mismatch";
  const remaining = remainingCentsFor(invoice, payments);
  if (transaction.amountCents === remaining) return "exact_match";
  if (transaction.amountCents > 0 && transaction.amountCents < remaining) {
    return "partial_match";
  }
  return "amount_mismatch";
}

export function matchesReconciliationFilters(
  transaction: BankTransaction,
  invoice: InvoiceRecord | undefined,
  payments: InvoicePayment[],
  filters: ReconciliationFilters,
) {
  const status = deriveQueueStatus(transaction, invoice, payments);
  if (filters.status !== "all" && status !== filters.status) return false;

  const confidence = matchConfidenceFor(transaction, invoice, payments);
  if (filters.confidence === "high" && confidence < 80) return false;
  if (filters.confidence === "medium" && (confidence < 50 || confidence >= 80)) return false;
  if (filters.confidence === "low" && confidence >= 50) return false;

  if (filters.period === "month" && !transaction.date.startsWith(ledgerToday.slice(0, 7))) {
    return false;
  }
  if (filters.period === "last_month") {
    if (!transaction.date.startsWith(previousMonthPrefix(ledgerToday))) return false;
  }

  const relation = amountRelation(transaction, invoice, payments);
  if (filters.amount !== "all" && relation !== filters.amount) return false;

  const query = filters.query.trim().toLowerCase();
  if (query) {
    const amountText = formatMoneyFromCents(transaction.amountCents).toLowerCase();
    const amountDigits = String(transaction.amountCents / 100);
    const haystack = [
      transaction.label,
      transaction.reference ?? "",
      transaction.sourceAccount ?? "",
      amountText,
      amountDigits,
      String(transaction.amountCents),
      invoice?.customerName ?? "",
      invoice ? invoiceDisplayNumber(invoice) : "",
      invoice?.number ?? "",
      invoice?.reference ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function sortBankTransactions(
  transactions: BankTransaction[],
  invoicesById: Map<string, InvoiceRecord>,
  payments: InvoicePayment[],
  preset: ReconciliationSortPreset,
) {
  const copy = [...transactions];
  copy.sort((left, right) => {
    const leftInvoice = left.suggestedInvoiceId
      ? invoicesById.get(left.suggestedInvoiceId)
      : left.matchedInvoiceId
        ? invoicesById.get(left.matchedInvoiceId)
        : undefined;
    const rightInvoice = right.suggestedInvoiceId
      ? invoicesById.get(right.suggestedInvoiceId)
      : right.matchedInvoiceId
        ? invoicesById.get(right.matchedInvoiceId)
        : undefined;

    if (preset === "highest") return right.amountCents - left.amountCents;
    if (preset === "lowest") return left.amountCents - right.amountCents;

    if (preset === "confidence_high" || preset === "confidence_low") {
      const leftScore = matchConfidenceFor(left, leftInvoice, payments);
      const rightScore = matchConfidenceFor(right, rightInvoice, payments);
      return preset === "confidence_high" ? rightScore - leftScore : leftScore - rightScore;
    }

    if (preset === "closest_amount") {
      const leftRemaining = leftInvoice ? remainingCentsFor(leftInvoice, payments) : Number.POSITIVE_INFINITY;
      const rightRemaining = rightInvoice
        ? remainingCentsFor(rightInvoice, payments)
        : Number.POSITIVE_INFINITY;
      const leftDelta = Number.isFinite(leftRemaining)
        ? Math.abs(left.amountCents - leftRemaining)
        : Number.POSITIVE_INFINITY;
      const rightDelta = Number.isFinite(rightRemaining)
        ? Math.abs(right.amountCents - rightRemaining)
        : Number.POSITIVE_INFINITY;
      return leftDelta - rightDelta;
    }

    const leftTime = `${left.date}${left.id}`;
    const rightTime = `${right.date}${right.id}`;
    return preset === "oldest"
      ? leftTime.localeCompare(rightTime)
      : rightTime.localeCompare(leftTime);
  });
  return copy;
}

export function filterAndSortBankTransactions(
  transactions: BankTransaction[],
  invoicesById: Map<string, InvoiceRecord>,
  payments: InvoicePayment[],
  filters: ReconciliationFilters,
) {
  const pending = pendingBankTransactions(transactions);
  const visible = pending.filter((transaction) => {
    const invoiceId = transaction.suggestedInvoiceId ?? transaction.matchedInvoiceId;
    const invoice = invoiceId ? invoicesById.get(invoiceId) : undefined;
    if (deriveQueueStatus(transaction, invoice, payments) === "matched") return false;
    return matchesReconciliationFilters(transaction, invoice, payments, filters);
  });
  return sortBankTransactions(visible, invoicesById, payments, filters.sort);
}
