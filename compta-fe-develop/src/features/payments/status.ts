import type { InvoicePaymentMethod } from "@/features/invoices/model";
import type { Tone } from "@/mocks/dashboard/types";

import type { PaymentListStatus } from "./model";
import type { ReconciliationQueueStatus } from "./reconciliation";

export const paymentListStatusTone: Record<PaymentListStatus, Tone> = {
  paid: "green",
  partial: "orange",
  unpaid: "slate",
  overdue: "red",
};

export const reconciliationQueueStatusTone: Record<ReconciliationQueueStatus, Tone> = {
  suggested_match: "blue",
  needs_review: "orange",
  matched: "green",
  unmatched: "slate",
  cannot_match: "red",
};

export const paymentMethodTone: Record<InvoicePaymentMethod, Tone> = {
  transfer: "blue",
  card: "purple",
  direct_debit: "orange",
  cash: "green",
  check: "slate",
};

export const paymentMethodColor: Record<InvoicePaymentMethod, string> = {
  transfer: "#2f6ef0",
  card: "#7b61c8",
  direct_debit: "#f59b2d",
  cash: "#1fb36e",
  check: "#7f93b0",
};

export const reconciliationDot: Record<"matched" | "to_match" | "needs_review", string> = {
  matched: "var(--dashboard-success, #1fb36e)",
  to_match: "#f59b2d",
  needs_review: "#e24b45",
};
