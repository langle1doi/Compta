"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";

import { StatusBadge } from "@/components/dashboard/tone";
import {
  invoiceDisplayNumber,
  remainingCentsFor,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { formatMoneyFromCents } from "@/lib/money";
import { useNestedScrollChain } from "@/lib/use-nested-scroll-chain";

import { nextActionCopy, paymentListStatus } from "../model";
import { paymentListStatusTone } from "../status";
import { PaymentMethodIcon } from "./payment-method-icon";
import { PaymentRemaining } from "./payment-remaining";
import { allowedActionCopy } from "./payment-table";

export function PaymentMobileList({
  payments,
  ledgerPayments,
  invoicesById,
  canRecord,
  canFollowUp,
  onOpen,
  onNextAction,
}: {
  payments: InvoicePayment[];
  ledgerPayments: InvoicePayment[];
  invoicesById: Map<string, InvoiceRecord>;
  canRecord: boolean;
  canFollowUp: boolean;
  onOpen: (id: string) => void;
  onNextAction: (id: string) => void;
}) {
  const t = useTranslations("payments");
  const scrollRef = useRef<HTMLUListElement>(null);
  useNestedScrollChain(scrollRef);
  const locale = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  return (
    <ul ref={scrollRef} className="dashboard-scroll--chain flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 lg:hidden">
      {payments.map((payment) => {
        const invoice = invoicesById.get(payment.invoiceId);
        const listStatus = paymentListStatus(payment, invoice, ledgerPayments);
        const action = allowedActionCopy(nextActionCopy(invoice, ledgerPayments), {
          canRecord,
          canFollowUp,
        });
        const remaining = invoice ? remainingCentsFor(invoice, ledgerPayments) : 0;
        const amount = formatMoneyFromCents(payment.amountCents);

        return (
          <li className="dashboard-card px-3 py-3" key={payment.id}>
            <button
              className="w-full min-w-0 text-left"
              onClick={() => onOpen(payment.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="dashboard-list__primary dashboard-list__link text-left tabular-nums">
                  {payment.reference}
                </span>
                <StatusBadge size="xs" tone={paymentListStatusTone[listStatus]}>
                  {t(`listStatus.${listStatus}`)}
                </StatusBadge>
              </div>
              <p className="dashboard-list__primary mt-1.5 truncate">
                {invoice?.customerName ?? "—"}
              </p>
              <p className="dashboard-list__secondary mt-0.5 tabular-nums">
                {invoice ? invoiceDisplayNumber(invoice) : "—"}
              </p>
              <strong className="dashboard-list__amount mt-1 block">{amount}</strong>
              <div className="mt-1">
                <PaymentRemaining remainingCents={remaining} status={listStatus} />
              </div>
              <p className="dashboard-list__secondary mt-1 inline-flex items-center gap-1.5">
                <PaymentMethodIcon method={payment.method} />
                {t(`methods.${payment.method}`)}
              </p>
              <p className="dashboard-list__secondary mt-1">
                {dateFmt.format(new Date(`${payment.date}T00:00:00`))}
              </p>
            </button>
            {canRecord || canFollowUp ? (
              <div className="mt-2 flex items-center justify-end">
                <button
                  className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-xs font-semibold text-[#044ce2]"
                  onClick={() => onNextAction(payment.id)}
                  type="button"
                >
                  {t(`actions.${action.key}`, action.values)}
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
