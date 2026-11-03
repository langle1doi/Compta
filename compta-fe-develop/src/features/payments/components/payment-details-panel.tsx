"use client";

import { ReceiptText, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
  TOP_TABS_ACTIVE_LAYOUT_ID,
} from "@/components/compte/animated-selection";
import { ActivityFeedItem } from "@/components/dashboard/activity-feed-item";
import { IconTile, StatusBadge } from "@/components/dashboard/tone";
import {
  derivePaymentStatus,
  invoiceDisplayNumber,
  invoiceTotals,
  paidCentsFor,
  remainingCentsFor,
  type BankTransaction,
  type InvoicePayment,
  type InvoiceRecord,
  type PaymentActivity,
} from "@/features/invoices/model";
import { ledgerToday } from "@/features/quotes/model";
import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { paymentListStatus } from "../model";
import { paymentListStatusTone, reconciliationDot } from "../status";
import { PaymentMethodIcon } from "./payment-method-icon";

const tabs = ["details", "invoice", "reconciliation", "activity"] as const;
type PanelTab = (typeof tabs)[number];

export function PaymentDetailsPanel({
  payment,
  invoice,
  ledgerPayments,
  bankTransaction,
  activities,
  onClose,
  onOpenInvoice,
}: {
  payment: InvoicePayment;
  invoice: InvoiceRecord | undefined;
  ledgerPayments: InvoicePayment[];
  bankTransaction: BankTransaction | undefined;
  activities: PaymentActivity[];
  onClose: () => void;
  onOpenInvoice?: () => void;
}) {
  const t = useTranslations("payments");
  const locale = useLocale();
  const [tab, setTab] = useState<PanelTab>("details");
  const listStatus = paymentListStatus(payment, invoice, ledgerPayments);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dateTime = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const paidBefore = invoice
    ? Math.max(0, paidCentsFor(invoice.id, ledgerPayments) - payment.amountCents)
    : 0;
  const totalPaid = invoice ? paidCentsFor(invoice.id, ledgerPayments) : 0;
  const remaining = invoice ? remainingCentsFor(invoice, ledgerPayments) : 0;
  const invoiceTotal = invoice ? invoiceTotals(invoice).ttcCents : 0;
  const invoicePaymentState = invoice
    ? derivePaymentStatus(invoice, ledgerPayments, ledgerToday)
    : null;
  const createdAt = payment.createdAt ?? activities[activities.length - 1]?.at;
  const createdBy = payment.createdBy ?? activities[activities.length - 1]?.actorName;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 shrink-0 bg-white/95 backdrop-blur-sm">
        <header className="border-b border-[#edf2f8] px-3.5 py-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 pt-0.5">
              <StatusBadge size="xs" tone={paymentListStatusTone[listStatus]}>
                {t(`listStatus.${listStatus}`)}
              </StatusBadge>
              <h3 className="mt-1.5 truncate text-[15px] font-semibold text-[#063586]">
                {t("panel.title", { reference: payment.reference })}
              </h3>
              <p className="mt-0.5 truncate text-sm font-medium text-[#24334c]">
                {invoice?.customerName ?? "—"}
              </p>
              <p className="truncate text-[11px] font-semibold tabular-nums text-[#7d8aa0]">
                {formatMoneyFromCents(payment.amountCents)}
              </p>
            </div>
            <button
              aria-label={t("close")}
              className="action-motion soft-button grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#66758d]"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </header>

        <AnimatedSelectionGroup className="min-w-0 border-b border-[#edf2f8] px-1.5" id="payment-detail-tabs">
          <div
            aria-label={t("panel.tabsLabel")}
            className="flex min-w-0 gap-0.5 overflow-x-auto py-1.5"
            role="tablist"
          >
            {tabs.map((item) => {
              const active = tab === item;
              return (
                <button
                  aria-selected={active}
                  className={cn(
                    "relative min-w-0 flex-1 truncate rounded-full px-1.5 py-2 text-[11px] font-semibold transition-colors duration-150",
                    active ? "text-[#2458d6]" : "text-[#7d8aa0] hover:text-[#405069]",
                  )}
                  key={item}
                  onClick={() => setTab(item)}
                  role="tab"
                  type="button"
                >
                  {active ? (
                    <AnimatedActiveIndicator
                      className="rounded-full"
                      layoutId={`${TOP_TABS_ACTIVE_LAYOUT_ID}-payment-details`}
                      variant="soft-pill"
                    />
                  ) : null}
                  <span className="relative z-[1] truncate">{t(`tabs.${item}`)}</span>
                </button>
              );
            })}
          </div>
        </AnimatedSelectionGroup>
      </div>

      <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        {tab === "details" ? (
          <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            <section className="rounded-[10px] border border-[#edf2f8] px-3 py-3">
              <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
                {t("sections.information")}
              </p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <Row label={t("columns.reference")} value={payment.reference} />
                <Row label={t("columns.amount")} value={formatMoneyFromCents(payment.amountCents)} />
                <Row
                  label={t("columns.date")}
                  value={dateFmt.format(new Date(`${payment.date}T00:00:00`))}
                />
                <Row
                  label={t("methodLabel")}
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <PaymentMethodIcon method={payment.method} />
                      {t(`methods.${payment.method}`)}
                    </span>
                  }
                />
                <Row label={t("customer")} value={invoice?.customerName ?? "—"} />
                <Row
                  label={t("invoice")}
                  value={invoice ? invoiceDisplayNumber(invoice) : "—"}
                />
                <Row label={t("record.reference")} value={payment.externalReference ?? "—"} />
                <Row label={t("record.bankReference")} value={payment.bankReference ?? "—"} />
                <Row label={t("details.createdBy")} value={createdBy ?? "—"} />
                <Row
                  label={t("details.createdAt")}
                  value={createdAt ? dateTime.format(new Date(createdAt)) : "—"}
                />
              </dl>
            </section>
          </div>
        ) : null}

        {tab === "invoice" ? (
          <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            {invoice ? (
              <section className="rounded-[10px] border border-[#edf2f8] px-3 py-3">
                <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
                  {t("tabs.invoice")}
                </p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <Row label={t("invoice")} value={invoiceDisplayNumber(invoice)} />
                  <Row label={t("customer")} value={invoice.customerName} />
                  <Row label={t("invoiceTab.total")} value={formatMoneyFromCents(invoiceTotal)} />
                  <Row label={t("invoiceTab.paidBefore")} value={formatMoneyFromCents(paidBefore)} />
                  <Row
                    label={t("invoiceTab.thisPayment")}
                    value={formatMoneyFromCents(payment.amountCents)}
                  />
                  <Row label={t("invoiceTab.totalPaid")} value={formatMoneyFromCents(totalPaid)} />
                  <Row label={t("invoiceTab.remaining")} value={formatMoneyFromCents(remaining)} />
                  <Row
                    label={t("invoiceTab.paymentState")}
                    value={
                      invoicePaymentState
                        ? t(`invoiceState.${invoicePaymentState}`)
                        : "—"
                    }
                  />
                </dl>
                {onOpenInvoice ? (
                  <button
                    className="action-motion soft-button mt-3 h-9 rounded-[9px] px-3 text-xs font-semibold text-[#044ce2]"
                    onClick={onOpenInvoice}
                    type="button"
                  >
                    {t("invoiceTab.open")}
                  </button>
                ) : null}
              </section>
            ) : (
              <p className="py-6 text-center text-xs text-[#7d8aa0]">{t("invoiceTab.missing")}</p>
            )}
          </div>
        ) : null}

        {tab === "reconciliation" ? (
          <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            <section className="rounded-[10px] border border-[#edf2f8] px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#24334c]">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: reconciliationDot[payment.reconciliationStatus] }}
                />
                {t(`reconciliation.${payment.reconciliationStatus}`)}
              </p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <Row
                  label={t("recon.invoice")}
                  value={invoice ? invoiceDisplayNumber(invoice) : "—"}
                />
                <Row
                  label={t("recon.bank")}
                  value={bankTransaction?.label ?? payment.bankReference ?? "—"}
                />
                <Row
                  label={t("recon.matchedOn")}
                  value={
                    bankTransaction
                      ? dateFmt.format(new Date(`${bankTransaction.date}T00:00:00`))
                      : dateFmt.format(new Date(`${payment.date}T00:00:00`))
                  }
                />
                <Row label={t("recon.source")} value={t("recon.manual")} />
              </dl>
            </section>
          </div>
        ) : null}

        {tab === "activity" ? (
          <ol
            className="flex flex-col gap-3 py-1"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            {activities.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#7d8aa0]">{t("activity.empty")}</p>
            ) : (
              activities.map((item, index) => {
                const isLatest = index === 0;
                const isLast = index === activities.length - 1;
                return (
                  <ActivityFeedItem
                    dateLabel={dateTime.format(new Date(item.at)).split(",")[0] ?? ""}
                    isFirst={index === 0}
                    isLast={isLast}
                    key={item.id}
                    live={isLatest}
                    timeLabel={new Intl.DateTimeFormat(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }).format(new Date(item.at))}
                  >
                    <article
                      className={cn(
                        "rounded-[10px] border border-[#edf2f8] bg-white px-3 py-2.5",
                        isLatest && "invoice-activity-card--live border-[#c6ebd9]",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <IconTile icon={ReceiptText} size="sm" tone="green" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#24334c]">
                            {t(`activity.${item.kind}`, {
                              amount: item.amountCents
                                ? formatMoneyFromCents(item.amountCents)
                                : "",
                              invoice: item.invoiceNumber ?? "",
                            })}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#7d8aa0]">{item.actorName}</p>
                        </div>
                      </div>
                    </article>
                  </ActivityFeedItem>
                );
              })
            )}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <dt className="shrink-0 text-[11px] text-[#7d8aa0]">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-medium text-[#24334c]">{value}</dd>
    </div>
  );
}
