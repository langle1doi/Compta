"use client";

import { useLocale, useTranslations } from "next-intl";

import { DashboardScroll } from "@/components/dashboard/dashboard-scroll";
import { StatusBadge } from "@/components/dashboard/tone";
import {
  invoiceDisplayNumber,
  remainingCentsFor,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { nextActionCopy, paymentListStatus } from "../model";
import { paymentListStatusTone } from "../status";
import { PaymentMethodIcon } from "./payment-method-icon";
import { PaymentRemaining } from "./payment-remaining";

const cell = "min-w-0 overflow-hidden";

/** What the next-action button does for this user: without the right, it only opens the payment. */
export function allowedActionCopy(
  action: ReturnType<typeof nextActionCopy>,
  caps: { canRecord: boolean; canFollowUp: boolean },
): ReturnType<typeof nextActionCopy> {
  if (action.key === "view") return action;
  const allowed = action.key === "followUp" ? caps.canFollowUp : caps.canRecord;
  return allowed ? action : { key: "view" };
}

export function PaymentTable({
  payments,
  ledgerPayments,
  invoicesById,
  selectedId,
  selectedIds,
  canRecord,
  canFollowUp,
  onToggleCheck,
  onToggleAll,
  onOpen,
  onOpenInvoice,
  onNextAction,
}: {
  payments: InvoicePayment[];
  ledgerPayments: InvoicePayment[];
  invoicesById: Map<string, InvoiceRecord>;
  selectedId: string | null;
  selectedIds: string[];
  canRecord: boolean;
  canFollowUp: boolean;
  onToggleCheck: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
  onOpenInvoice?: (invoiceId: string) => void;
  onNextAction: (id: string) => void;
}) {
  const t = useTranslations("payments");
  const workT = useTranslations();
  const locale = useLocale();
  const allChecked = payments.length > 0 && selectedIds.length === payments.length;
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  // Without any of these the button could only open the payment, which the row already does.
  const showNext = canRecord || canFollowUp;

  return (
    <DashboardScroll scrollClassName="overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-[880px] table-fixed border-separate border-spacing-0 text-left">
        <colgroup>
          <col style={{ width: "4%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "8%" }} />
          {showNext ? <col style={{ width: "8%" }} /> : null}
        </colgroup>
        <thead className="dashboard-list__head">
          <tr>
            <th className={cell}>
              <input
                aria-label={t("table.selectAll")}
                checked={allChecked}
                className="h-3.5 w-3.5 accent-[#044ce2]"
                onChange={onToggleAll}
                type="checkbox"
              />
            </th>
            <th className={cell}>{t("columns.reference")}</th>
            <th className={cell}>{t("columns.customer")}</th>
            <th className={cell}>{t("columns.invoice")}</th>
            <th className={cell}>{t("columns.method")}</th>
            <th className={cell}>{t("columns.date")}</th>
            <th className={`${cell} text-right`}>{t("columns.amount")}</th>
            <th className={`${cell} text-right`}>{t("columns.remaining")}</th>
            <th className={cell}>{t("columns.status")}</th>
            {showNext ? <th className={cell}>{t("columns.next")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const invoice = invoicesById.get(payment.invoiceId);
            const listStatus = paymentListStatus(payment, invoice, ledgerPayments);
            const action = allowedActionCopy(nextActionCopy(invoice, ledgerPayments), {
              canRecord,
              canFollowUp,
            });
            const remaining = invoice ? remainingCentsFor(invoice, ledgerPayments) : 0;
            const checked = selectedIds.includes(payment.id);
            const active = selectedId === payment.id;
            const work = invoice ? workT(invoice.workKey) : "";
            const amount = formatMoneyFromCents(payment.amountCents);

            return (
              <tr
                className={cn(
                  "dashboard-list__row cursor-pointer",
                  active && "bg-[#eef4ff]",
                )}
                key={payment.id}
                onClick={() => onOpen(payment.id)}
              >
                <td className={cn(cell, "relative")}>
                  {active ? (
                    <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[#044ce2]" />
                  ) : null}
                  <input
                    aria-label={t("table.selectRow", { id: payment.reference })}
                    checked={checked}
                    className="h-3.5 w-3.5 accent-[#044ce2]"
                    onChange={() => onToggleCheck(payment.id)}
                    onClick={(event) => event.stopPropagation()}
                    type="checkbox"
                  />
                </td>
                <td className={cell}>
                  <button
                    className="dashboard-list__primary dashboard-list__link tabular-nums"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(payment.id);
                    }}
                    type="button"
                  >
                    {payment.reference}
                  </button>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__primary" title={invoice?.customerName}>
                    {invoice?.customerName ?? "—"}
                  </span>
                  <span className="dashboard-list__secondary" title={work}>
                    {work}
                  </span>
                </td>
                <td className={cell}>
                  {invoice && !onOpenInvoice ? (
                    <span className="dashboard-list__primary tabular-nums">
                      {invoiceDisplayNumber(invoice)}
                    </span>
                  ) : invoice && onOpenInvoice ? (
                    <button
                      className="dashboard-list__primary dashboard-list__link tabular-nums"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenInvoice(invoice.id);
                      }}
                      type="button"
                    >
                      {invoiceDisplayNumber(invoice)}
                    </button>
                  ) : (
                    <span className="dashboard-list__secondary">—</span>
                  )}
                </td>
                <td className={cell}>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <PaymentMethodIcon method={payment.method} />
                    <span className="dashboard-list__primary truncate">
                      {t(`methods.${payment.method}`)}
                    </span>
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__secondary tabular-nums">
                    {dateFmt.format(new Date(`${payment.date}T00:00:00`))}
                  </span>
                </td>
                <td className={`${cell} text-right`}>
                  <span className="dashboard-list__amount block truncate" title={amount}>
                    {amount}
                  </span>
                </td>
                <td className={`${cell} text-right`}>
                  <PaymentRemaining remainingCents={remaining} status={listStatus} align="right" />
                </td>
                <td className={cell}>
                  <StatusBadge
                    className="dashboard-list__badge max-w-full"
                    size="xs"
                    tone={paymentListStatusTone[listStatus]}
                  >
                    {t(`listStatus.${listStatus}`)}
                  </StatusBadge>
                </td>
                {showNext ? (
                  <td className={cn(cell, "relative z-[1]")}>
                    <button
                      className="action-motion soft-button relative z-[1] h-7 max-w-full truncate rounded-[8px] px-2 text-[11px] font-semibold text-[#044ce2]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onNextAction(payment.id);
                      }}
                      type="button"
                    >
                      {t(`actions.${action.key}`, action.values)}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </DashboardScroll>
  );
}
