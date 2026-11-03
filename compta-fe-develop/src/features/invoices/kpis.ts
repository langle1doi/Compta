import { ledgerToday } from "@/features/quotes/model";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";

import {
  derivePaymentStatus,
  invoiceTotals,
  isInvoiceLocked,
  paidCentsFor,
  type InvoicePayment,
  type InvoiceRecord,
} from "./model";

export type InvoiceKpis = {
  invoicedCents: number;
  outstandingCents: number;
  overdueCents: number;
  paidCents: number;
  invoicedDeltaRatio: number;
  outstandingDeltaRatio: number;
  overdueDeltaRatio: number;
  paidDeltaRatio: number;
};

const PRIOR = {
  invoicedCents: 0,
  outstandingCents: 6_200_000,
  overdueCents: 3_200_000,
  paidCents: 1_100_000,
};

function isCurrentMonth(iso: string) {
  return iso.startsWith(ledgerToday.slice(0, 7));
}

function remainingCents(invoice: InvoiceRecord, payments: InvoicePayment[]) {
  return Math.max(0, invoiceTotals(invoice).ttcCents - paidCentsFor(invoice.id, payments));
}

export function getInvoiceKpis(invoices: InvoiceRecord[], payments: InvoicePayment[]): InvoiceKpis {
  const invoicedCents = invoices
    .filter((invoice) => isInvoiceLocked(invoice) && isCurrentMonth(invoice.issueDate))
    .reduce((sum, invoice) => sum + invoiceTotals(invoice).ttcCents, 0);

  const outstandingCents = invoices
    .filter((invoice) => {
      if (!isInvoiceLocked(invoice)) return false;
      const status = derivePaymentStatus(invoice, payments, ledgerToday);
      return status === "unpaid" || status === "partial" || status === "overdue";
    })
    .reduce((sum, invoice) => sum + remainingCents(invoice, payments), 0);

  const overdueCents = invoices
    .filter((invoice) => derivePaymentStatus(invoice, payments, ledgerToday) === "overdue")
    .reduce((sum, invoice) => sum + remainingCents(invoice, payments), 0);

  const paidCents = payments
    .filter((payment) => payment.status === "completed" && isCurrentMonth(payment.date))
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  return {
    invoicedCents,
    outstandingCents,
    overdueCents,
    paidCents,
    invoicedDeltaRatio: PRIOR.invoicedCents === 0 ? 0 : invoicedCents / PRIOR.invoicedCents - 1,
    outstandingDeltaRatio:
      PRIOR.outstandingCents === 0 ? 0 : outstandingCents / PRIOR.outstandingCents - 1,
    overdueDeltaRatio: PRIOR.overdueCents === 0 ? 0 : overdueCents / PRIOR.overdueCents - 1,
    paidDeltaRatio: PRIOR.paidCents === 0 ? 0 : paidCents / PRIOR.paidCents - 1,
  };
}

export function formatInvoiceKpiValue(cents: number) {
  return formatMoneyFromCents(cents);
}

export function formatInvoiceKpiDelta(ratio: number) {
  const sign = ratio >= 0 ? "+" : "";
  return `${sign}${formatPercent(ratio)}`;
}
