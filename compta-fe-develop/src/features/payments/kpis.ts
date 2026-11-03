import {
  derivePaymentStatus,
  isInvoiceLocked,
  remainingCentsFor,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { ledgerToday } from "@/features/quotes/model";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";

import { collectionStatus } from "./model";

export type PaymentKpis = {
  collectedCents: number;
  outstandingCents: number;
  outstandingCount: number;
  partialCents: number;
  partialCount: number;
  overdueCents: number;
  overdueCount: number;
  collectedDeltaRatio: number;
  outstandingDeltaRatio: number;
  partialDeltaRatio: number;
  overdueDeltaRatio: number;
};

const PRIOR = {
  collectedCents: 1_100_000,
  outstandingCents: 6_200_000,
  partialCents: 2_900_000,
  overdueCents: 3_200_000,
};

function isCurrentMonth(iso: string) {
  return iso.startsWith(ledgerToday.slice(0, 7));
}

export function getPaymentKpis(
  invoices: InvoiceRecord[],
  payments: InvoicePayment[],
): PaymentKpis {
  const collectedCents = payments
    .filter((payment) => payment.status === "completed" && isCurrentMonth(payment.date))
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  const open = invoices.filter((invoice) => {
    if (!isInvoiceLocked(invoice)) return false;
    return remainingCentsFor(invoice, payments) > 0;
  });

  const outstandingCents = open.reduce(
    (sum, invoice) => sum + remainingCentsFor(invoice, payments),
    0,
  );

  const partial = invoices.filter(
    (invoice) => collectionStatus(invoice, payments) === "partial",
  );
  const partialCents = partial.reduce(
    (sum, invoice) => sum + remainingCentsFor(invoice, payments),
    0,
  );

  const overdue = invoices.filter(
    (invoice) => collectionStatus(invoice, payments) === "overdue",
  );
  const overdueCents = overdue.reduce(
    (sum, invoice) => sum + remainingCentsFor(invoice, payments),
    0,
  );

  return {
    collectedCents,
    outstandingCents,
    outstandingCount: open.length,
    partialCents,
    partialCount: partial.length,
    overdueCents,
    overdueCount: overdue.length,
    collectedDeltaRatio:
      PRIOR.collectedCents === 0 ? 0 : collectedCents / PRIOR.collectedCents - 1,
    outstandingDeltaRatio:
      PRIOR.outstandingCents === 0 ? 0 : outstandingCents / PRIOR.outstandingCents - 1,
    partialDeltaRatio: PRIOR.partialCents === 0 ? 0 : partialCents / PRIOR.partialCents - 1,
    overdueDeltaRatio: PRIOR.overdueCents === 0 ? 0 : overdueCents / PRIOR.overdueCents - 1,
  };
}

export function formatPaymentKpiValue(cents: number) {
  return formatMoneyFromCents(cents);
}

export function formatPaymentKpiDelta(ratio: number) {
  const sign = ratio >= 0 ? "+" : "";
  return `${sign}${formatPercent(ratio)}`;
}

export function paymentMethodBreakdown(payments: InvoicePayment[]) {
  const completed = payments.filter((payment) => payment.status === "completed");
  const total = completed.reduce((sum, payment) => sum + payment.amountCents, 0) || 1;
  const byMethod = new Map<InvoicePayment["method"], number>();
  for (const payment of completed) {
    byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amountCents);
  }
  return [...byMethod.entries()].map(([method, amountCents]) => ({
    method,
    amountCents,
    ratio: amountCents / total,
  }));
}

export function collectionHealth(invoices: InvoiceRecord[], payments: InvoicePayment[]) {
  const locked = invoices.filter((invoice) => isInvoiceLocked(invoice));
  const total = locked.length || 1;
  const onTime = locked.filter(
    (invoice) => derivePaymentStatus(invoice, payments, ledgerToday) === "paid",
  ).length;
  const partial = locked.filter(
    (invoice) => derivePaymentStatus(invoice, payments, ledgerToday) === "partial",
  ).length;
  const overdue = locked.filter(
    (invoice) => derivePaymentStatus(invoice, payments, ledgerToday) === "overdue",
  ).length;
  return {
    onTime,
    partial,
    overdue,
    onTimeRatio: onTime / total,
    partialRatio: partial / total,
    overdueRatio: overdue / total,
  };
}
