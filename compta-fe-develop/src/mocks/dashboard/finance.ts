import { parseAmount } from "@/lib/money";

import { invoicesToFollow } from "./invoices-to-follow";
import { pipelineSummary } from "./pipeline";

/** Demo fiscal year shown on the dashboard. October is the running month. */
export const fiscalYear = 2026;
export const currentMonthIndex = 9;

/** Monthly invoiced revenue (HT) for the demo year; `null` = month not started. */
export const monthlyRevenue: Array<number | null> = [
  82_400, 76_900, 91_200, 88_600, 97_300, 102_800, 94_500, 79_200, 108_300, 128_450, null, null,
];

export const monthlyCollected: Array<number | null> = [
  74_100, 71_800, 83_500, 85_900, 88_400, 96_100, 90_200, 77_600, 99_800, 90_700, null, null,
];

export const monthlyTarget: number[] = [
  85_000, 85_000, 90_000, 90_000, 95_000, 100_000, 95_000, 85_000, 105_000, 115_000, 115_000, 120_000,
];

export const previousYears = [
  { year: 2024, revenue: 1_012_300, collected: 968_400, target: 1_000_000 },
  { year: 2025, revenue: 1_096_800, collected: 1_041_200, target: 1_080_000 },
];

export type ReceivableSegmentKey = "overdue" | "partial" | "dueSoon" | "open";

/** Open receivables: the four invoices still awaiting payment. */
export const receivableSegments: Array<{
  key: ReceivableSegmentKey;
  amount: number;
  invoices: number;
}> = [
  { key: "overdue", amount: 24_300, invoices: 1 },
  { key: "partial", amount: 4_850, invoices: 1 },
  { key: "dueSoon", amount: 5_600, invoices: 1 },
  { key: "open", amount: 3_000, invoices: 1 },
];

const sum = (values: Array<number | null>) =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);

export const receivablesTotal = sum(receivableSegments.map((segment) => segment.amount));
export const receivablesInvoiceCount = sum(receivableSegments.map((segment) => segment.invoices));
export const overdueTotal =
  receivableSegments.find((segment) => segment.key === "overdue")?.amount ?? 0;
export const dueSoonTotal =
  receivableSegments.find((segment) => segment.key === "dueSoon")?.amount ?? 0;

export const currentMonthRevenue = monthlyRevenue[currentMonthIndex] ?? 0;
export const previousMonthRevenue = monthlyRevenue[currentMonthIndex - 1] ?? 0;
/** Invoiced this month and already collected = revenue minus what is still open. */
export const currentMonthCollected = currentMonthRevenue - receivablesTotal;
export const collectionRate = currentMonthCollected / currentMonthRevenue;

export type PaymentSegmentKey = "paid" | "partial" | "open" | "overdue";

export const paymentSegments: Array<{ key: PaymentSegmentKey; amount: number }> = [
  { key: "paid", amount: currentMonthCollected },
  { key: "partial", amount: receivableSegments[1].amount },
  {
    key: "open",
    amount: receivableSegments[2].amount + receivableSegments[3].amount,
  },
  { key: "overdue", amount: overdueTotal },
];

export const yearToDateRevenue = sum(monthlyRevenue);
export const yearToDateCollected = sum(monthlyCollected);
export const annualTarget = sum(monthlyTarget);
export const annualTargetRate = yearToDateRevenue / annualTarget;

export const annualPlan = [
  ...previousYears.map((entry) => ({
    year: entry.year,
    realized: entry.revenue,
    target: entry.target,
    inProgress: false,
  })),
  { year: fiscalYear, realized: yearToDateRevenue, target: annualTarget, inProgress: true },
];

const overdueInvoiceCount = invoicesToFollow.filter(
  (invoice) => invoice.statusKey === "status.overdue",
).length;

export const businessHealth = {
  conversion: parseAmount(pipelineSummary.closeRate) / 100,
  collection: collectionRate,
  onTime: (invoicesToFollow.length - overdueInvoiceCount) / invoicesToFollow.length,
  target: annualTargetRate,
};
