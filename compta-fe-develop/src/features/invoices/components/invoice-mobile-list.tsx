"use client";

import { useLocale, useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import { ledgerToday } from "@/features/quotes/model";
import { formatMoneyFromCents } from "@/lib/money";

import {
  invoiceDisplayNumber,
  invoiceListStatus,
  invoiceTotals,
  nextInvoiceAction,
  type InvoicePayment,
  type InvoiceRecord,
} from "../model";
import { invoiceListStatusTone } from "../status";
import { allowedInvoiceAction, InvoiceRowMenu, type InvoiceMenuAction } from "./invoice-row-menu";

export function InvoiceMobileList({
  invoices,
  payments,
  canUpdate,
  canValidate,
  canFollowUp,
  canSend,
  onOpen,
  onNextAction,
  onMenuAction,
}: {
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  canUpdate: boolean;
  canValidate: boolean;
  canFollowUp: boolean;
  canSend: boolean;
  onOpen: (id: string) => void;
  onNextAction: (id: string) => void;
  onMenuAction: (id: string, action: InvoiceMenuAction) => void;
}) {
  const t = useTranslations("invoices");
  const locale = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  // Without any of these the button could only open the invoice, which the card already does.
  const showNext = canUpdate || canValidate || canFollowUp;

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 lg:hidden">
      {invoices.map((invoice) => {
        const amount = formatMoneyFromCents(invoiceTotals(invoice).ttcCents);
        const listStatus = invoiceListStatus(invoice, payments, ledgerToday);
        const next = allowedInvoiceAction(nextInvoiceAction(invoice, payments, ledgerToday), {
          canUpdate,
          canValidate,
          canFollowUp,
        });

        return (
          <li
            className="dashboard-card cursor-pointer px-3 py-3"
            key={invoice.id}
            onClick={() => onOpen(invoice.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="dashboard-list__primary dashboard-list__link tabular-nums">
                {invoiceDisplayNumber(invoice)}
              </span>
              <StatusBadge
                size="xs"
                tone={invoiceListStatusTone[listStatus === "all" ? "draft" : listStatus]}
              >
                {t(`listStatus.${listStatus}`)}
              </StatusBadge>
            </div>
            <p className="dashboard-list__primary mt-1.5 truncate">{invoice.customerName}</p>
            <strong className="dashboard-list__amount mt-1 block">{amount}</strong>
            <p className="dashboard-list__secondary mt-1">
              {t("mobileIssued", {
                date: dateFmt.format(new Date(`${invoice.issueDate}T00:00:00`)),
              })}
              <span className="mx-1.5 text-[#c5ceda]">·</span>
              {t("mobileDue", {
                date: dateFmt.format(new Date(`${invoice.dueDate}T00:00:00`)),
              })}
            </p>
            <p className="dashboard-list__secondary mt-0.5 tabular-nums">{invoice.quoteId}</p>
            <div className="mt-2 flex items-center justify-end gap-1.5">
              {showNext ? (
                <button
                  className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-xs font-semibold text-[#044ce2]"
                  onClick={(event) => {
                    event.stopPropagation();
                    onNextAction(invoice.id);
                  }}
                  type="button"
                >
                  {t(`actions.${next}`)}
                </button>
              ) : null}
              <InvoiceRowMenu
                canSend={canSend}
                canUpdate={canUpdate}
                invoice={invoice}
                onAction={(action) => onMenuAction(invoice.id, action)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
