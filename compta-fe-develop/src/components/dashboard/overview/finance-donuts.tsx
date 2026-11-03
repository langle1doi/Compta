import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";

import { formatEuroCompact, formatPercent } from "@/lib/money";
import {
  collectionRate,
  paymentSegments,
  receivableSegments,
  receivablesInvoiceCount,
  receivablesTotal,
  type PaymentSegmentKey,
  type ReceivableSegmentKey,
} from "@/mocks/dashboard";

import { StatusDonut } from "./status-donut";

const receivableColors: Record<ReceivableSegmentKey, string> = {
  overdue: "#162a50",
  partial: "#386eea",
  dueSoon: "#22c6d9",
  open: "#86dce7",
};

const paymentColors: Record<PaymentSegmentKey, string> = {
  paid: "#22c6d9",
  partial: "#386eea",
  open: "#86dce7",
  overdue: "#162a50",
};

export async function ReceivablesDonut({ style }: { style?: CSSProperties }) {
  const t = await getTranslations("overview");

  return (
    <StatusDonut
      action={t("receivables.action")}
      actionHref="#dashboard-invoices"
      centerLabel={t("receivables.center")}
      centerValue={formatEuroCompact(receivablesTotal)}
      footnote={t("summary.pending", { count: receivablesInvoiceCount })}
      id="dashboard-receivables"
      segments={receivableSegments.map((segment) => ({
        key: segment.key,
        label: t(`receivables.${segment.key}`),
        amount: segment.amount,
        color: receivableColors[segment.key],
      }))}
      style={style}
      title={t("receivables.title")}
    />
  );
}

export async function PaymentsDonut({ style }: { style?: CSSProperties }) {
  const t = await getTranslations("overview");

  return (
    <StatusDonut
      centerLabel={t("payments.center")}
      centerValue={formatPercent(collectionRate)}
      footnote={t("payments.scope")}
      id="dashboard-payments"
      segments={paymentSegments.map((segment) => ({
        key: segment.key,
        label: t(`payments.${segment.key}`),
        amount: segment.amount,
        color: paymentColors[segment.key],
      }))}
      style={style}
      title={t("payments.title")}
    />
  );
}
