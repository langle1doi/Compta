import type { Tone } from "@/mocks/dashboard/types";

import type { InvoiceDocumentStatus, InvoiceListStatusFilter, InvoicePaymentStatus } from "./model";

export const invoiceDocumentTone: Record<InvoiceDocumentStatus, Tone> = {
  draft: "slate",
  to_validate: "orange",
  validated: "blue",
  sent: "blue",
};

export const invoicePaymentTone: Record<InvoicePaymentStatus, Tone> = {
  unpaid: "blue",
  partial: "orange",
  paid: "green",
  overdue: "red",
};

export const invoiceListStatusTone: Record<Exclude<InvoiceListStatusFilter, "all">, Tone> = {
  draft: "slate",
  to_validate: "orange",
  validated: "blue",
  sent: "blue",
  unpaid: "blue",
  partial: "orange",
  paid: "green",
  overdue: "red",
};

export const INVOICE_STATUS_FILTERS: InvoiceListStatusFilter[] = [
  "all",
  "draft",
  "to_validate",
  "sent",
  "partial",
  "paid",
  "overdue",
];
