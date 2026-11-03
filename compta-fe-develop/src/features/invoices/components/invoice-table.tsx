"use client";

import { useLocale, useTranslations } from "next-intl";

import { DashboardScroll } from "@/components/dashboard/dashboard-scroll";
import { StatusBadge } from "@/components/dashboard/tone";
import { ledgerToday } from "@/features/quotes/model";
import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  invoiceDisplayNumber,
  invoiceListStatus,
  invoiceTotals,
  nextInvoiceAction,
  type InvoicePayment,
  type InvoiceRecord,
} from "../model";
import { invoiceOwnerById } from "../query";
import { invoiceListStatusTone } from "../status";
import { allowedInvoiceAction, InvoiceRowMenu, type InvoiceMenuAction } from "./invoice-row-menu";

const cell = "min-w-0 overflow-hidden";

export function InvoiceTable({
  invoices,
  payments,
  selectedId,
  selectedIds,
  canUpdate,
  canValidate,
  canFollowUp,
  canSend,
  onToggleCheck,
  onToggleAll,
  onOpen,
  onNextAction,
  onMenuAction,
}: {
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  selectedId: string | null;
  selectedIds: string[];
  canUpdate: boolean;
  canValidate: boolean;
  canFollowUp: boolean;
  canSend: boolean;
  onToggleCheck: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
  onNextAction: (id: string) => void;
  onMenuAction: (id: string, action: InvoiceMenuAction) => void;
}) {
  const t = useTranslations("invoices");
  const workT = useTranslations();
  const locale = useLocale();
  const allChecked = invoices.length > 0 && selectedIds.length === invoices.length;
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  // Without any of these the button could only open the invoice, which the row already does.
  const showNext = canUpdate || canValidate || canFollowUp;

  return (
    <DashboardScroll scrollClassName="overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-0 text-left xl:min-w-0">
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 128 }} />
          <col />
          <col style={{ width: 120 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 110 }} />
          {showNext ? <col style={{ width: 110 }} /> : null}
          <col style={{ width: 44 }} />
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
            <th className={cell}>{t("number")}</th>
            <th className={cell}>{t("customer")}</th>
            <th className={cell}>{t("quotePo")}</th>
            <th className={cell}>{t("owner")}</th>
            <th className={cell}>{t("issueDate")}</th>
            <th className={cell}>{t("dueDate")}</th>
            <th className={`${cell} text-right`}>{t("total")}</th>
            <th className={cell}>{t("statusLabel")}</th>
            {showNext ? <th className={cell}>{t("next")}</th> : null}
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const owner = invoiceOwnerById(invoice.ownerId);
            const amount = formatMoneyFromCents(invoiceTotals(invoice).ttcCents);
            const listStatus = invoiceListStatus(invoice, payments, ledgerToday);
            const next = allowedInvoiceAction(nextInvoiceAction(invoice, payments, ledgerToday), {
              canUpdate,
              canValidate,
              canFollowUp,
            });
            const checked = selectedIds.includes(invoice.id);
            const active = selectedId === invoice.id;
            const work = workT(invoice.workKey);

            return (
              <tr
                className={cn(
                  "dashboard-list__row cursor-pointer",
                  active && "bg-[#eef4ff]",
                )}
                key={invoice.id}
                onClick={() => onOpen(invoice.id)}
              >
                <td className={cn(cell, "relative")}>
                  {active ? (
                    <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[#044ce2]" />
                  ) : null}
                  <input
                    aria-label={t("table.selectRow", { id: invoiceDisplayNumber(invoice) })}
                    checked={checked}
                    className="h-3.5 w-3.5 accent-[#044ce2]"
                    onChange={() => onToggleCheck(invoice.id)}
                    onClick={(event) => event.stopPropagation()}
                    type="checkbox"
                  />
                </td>
                <td className={cell}>
                  <span
                    className="dashboard-list__primary dashboard-list__link block max-w-full truncate text-left tabular-nums"
                    title={invoiceDisplayNumber(invoice)}
                  >
                    {invoiceDisplayNumber(invoice)}
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__primary" title={invoice.customerName}>
                    {invoice.customerName}
                  </span>
                  <span className="dashboard-list__secondary" title={invoice.reference ?? work}>
                    {invoice.reference ?? work}
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__primary tabular-nums">{invoice.quoteId}</span>
                  {invoice.poNumber ? (
                    <span className="dashboard-list__secondary">{invoice.poNumber}</span>
                  ) : null}
                </td>
                <td className={cell}>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span className="dashboard-list__avatar shrink-0" title={owner?.name}>
                      {owner?.initials ?? "—"}
                    </span>
                    <span className="dashboard-list__primary truncate" title={owner?.name}>
                      {owner?.name ?? "—"}
                    </span>
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__secondary tabular-nums">
                    {dateFmt.format(new Date(`${invoice.issueDate}T00:00:00`))}
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__secondary tabular-nums">
                    {dateFmt.format(new Date(`${invoice.dueDate}T00:00:00`))}
                  </span>
                </td>
                <td className={`${cell} text-right`}>
                  <span className="dashboard-list__amount block truncate" title={amount}>
                    {amount}
                  </span>
                </td>
                <td className={cell}>
                  <StatusBadge
                    className="dashboard-list__badge max-w-full"
                    size="xs"
                    tone={invoiceListStatusTone[listStatus === "all" ? "draft" : listStatus]}
                  >
                    {t(`listStatus.${listStatus}`)}
                  </StatusBadge>
                </td>
                {showNext ? (
                  <td className={cell}>
                    <button
                      className="action-motion soft-button h-7 rounded-[8px] px-2 text-[11px] font-semibold text-[#044ce2]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onNextAction(invoice.id);
                      }}
                      type="button"
                    >
                      {t(`actions.${next}`)}
                    </button>
                  </td>
                ) : null}
                <td className={cell}>
                  <InvoiceRowMenu
                    canSend={canSend}
                    canUpdate={canUpdate}
                    invoice={invoice}
                    onAction={(action) => onMenuAction(invoice.id, action)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DashboardScroll>
  );
}
