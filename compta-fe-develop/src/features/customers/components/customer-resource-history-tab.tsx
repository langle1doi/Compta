"use client";

import { FileText, MoreHorizontal, Plus, ReceiptText, WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import { PageSizeSelect } from "@/components/compte/page-size-select";
import { StatusBadge } from "@/components/dashboard/tone";
import {
  invoiceDisplayNumber,
  invoiceListStatus,
  invoiceTotals,
} from "@/features/invoices/model";
import { useInvoicePayments, useInvoices } from "@/features/invoices/store";
import { ledgerToday } from "@/features/quotes/model";
import { Link } from "@/i18n/navigation";
import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  hasAcceptedQuoteReady,
  hasEligibleInvoiceForPayment,
  invoiceStatusTone,
  isInvoiceLocked,
  paymentStatusTone,
  quoteStatusTone,
} from "../customer-history";
import type { CustomerInvoiceStatus, CustomerInvoiceSummary, CustomerRecord } from "../types";
import { CustomerHistoryEmpty } from "./customer-history-empty";

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

function formatShortDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function ResourceHeader({
  title,
  count,
  action,
}: {
  title: string;
  count: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#edf2f8] py-2">
      <h3 className="text-[13px] font-semibold text-[#24334c]">
        {title}{" "}
        <span className="font-medium text-[#7d8aa0]">({count})</span>
      </h3>
      {action}
    </div>
  );
}

function ResourcePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const t = useTranslations("customers");
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  if (total <= PAGE_SIZE_OPTIONS[0]) return null;

  return (
    <footer className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#edf2f8] pt-2">
      <p className="text-[11px] text-[#7d8aa0]">
        {t("pagination.summary", {
          from: total === 0 ? 0 : safePage * pageSize + 1,
          to: Math.min(total, (safePage + 1) * pageSize),
          total,
        })}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PageSizeSelect
          formatOption={(count) =>
            t("pagination.rowsPerPage", { count })
          }
          label={t("pagination.pageSize")}
          options={PAGE_SIZE_OPTIONS}
          triggerClassName="!h-7 min-w-[6.5rem] rounded-[7px] px-1.5 text-[10px]"
          value={pageSize}
          onChange={onPageSizeChange}
        />
        <button
          className="h-7 rounded-[7px] px-2 text-[10px] font-semibold text-[#044ce2] disabled:text-[#b7c3d6]"
          disabled={safePage <= 0}
          type="button"
          onClick={() => onPageChange(safePage - 1)}
        >
          {t("pagination.prev")}
        </button>
        <button
          className="h-7 rounded-[7px] px-2 text-[10px] font-semibold text-[#044ce2] disabled:text-[#b7c3d6]"
          disabled={safePage >= pageCount - 1}
          type="button"
          onClick={() => onPageChange(safePage + 1)}
        >
          {t("pagination.next")}
        </button>
      </div>
    </footer>
  );
}

function RowMenu({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; label: string; disabled?: boolean; onClick?: () => void }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label={label}
        className="action-motion grid h-7 w-7 place-items-center rounded-[7px] text-[#7d8aa0] hover:bg-[#eef3fa] hover:text-[#044ce2]"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+2px)] right-0 z-20 w-40 rounded-[10px] border border-[#e8eef6] bg-white p-1 shadow-[0_10px_28px_rgb(29_43_68/0.12)]">
          {items.map((item) => (
            <button
              className={cn(
                "flex min-h-8 w-full items-center rounded-[7px] px-2 text-left text-[11px] font-semibold",
                item.disabled
                  ? "cursor-not-allowed text-[#b7c3d6]"
                  : "text-[#405069] hover:bg-[#f5f8fd]",
              )}
              disabled={item.disabled}
              key={item.id}
              type="button"
              onClick={() => {
                item.onClick?.();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CustomerQuotesTab({
  customer,
  canCreate,
  onNewQuote,
}: {
  customer: CustomerRecord;
  canCreate: boolean;
  onNewQuote: () => void;
}) {
  const t = useTranslations("customers");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const rows = customer.quotes;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResourceHeader
        action={
          canCreate ? (
            <button
              className="action-motion soft-primary inline-flex h-8 items-center gap-1 rounded-[8px] px-2.5 text-[11px] font-semibold text-white"
              type="button"
              onClick={onNewQuote}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              {t("actions.newQuote")}
            </button>
          ) : null
        }
        count={rows.length}
        title={t("historyTabs.quotes")}
      />

      {rows.length === 0 ? (
        <CustomerHistoryEmpty
          action={
            canCreate ? (
              <button
                className="action-motion soft-primary inline-flex h-9 items-center gap-1 rounded-[9px] px-3 text-xs font-semibold text-white"
                type="button"
                onClick={onNewQuote}
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                {t("actions.newQuote")}
              </button>
            ) : null
          }
          body={t("historyTabs.quotesEmptyBody")}
          icon={FileText}
          title={t("historyTabs.quotesEmptyTitle")}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="hidden w-full table-fixed text-left md:table">
              <thead>
                <tr className="text-[10px] font-semibold tracking-wide text-[#98a4b5] uppercase">
                  <th className="px-1 py-2 font-semibold">{t("history.number")}</th>
                  <th className="px-1 py-2 font-semibold">{t("history.date")}</th>
                  <th className="hidden px-1 py-2 font-semibold lg:table-cell">
                    {t("history.validUntil")}
                  </th>
                  <th className="px-1 py-2 font-semibold">{t("history.amount")}</th>
                  <th className="px-1 py-2 font-semibold">{t("history.status")}</th>
                  <th className="w-10 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((quote) => (
                  <tr
                    className="border-t border-[#eef2f7] transition-colors hover:bg-[#f7faff]"
                    key={quote.id}
                  >
                    <td className="truncate px-1 py-2.5 text-xs font-semibold text-[#24334c]">
                      {quote.number}
                    </td>
                    <td className="px-1 py-2.5 text-xs text-[#405069]">
                      {formatShortDate(quote.date)}
                    </td>
                    <td className="hidden px-1 py-2.5 text-xs text-[#405069] lg:table-cell">
                      {quote.validUntil ? formatShortDate(quote.validUntil) : "—"}
                    </td>
                    <td className="px-1 py-2.5 text-xs tabular-nums text-[#405069]">
                      {formatMoneyFromCents(quote.amountCents)}
                    </td>
                    <td className="px-1 py-2.5">
                      <StatusBadge size="xs" tone={quoteStatusTone(quote.status)}>
                        {t(`quoteStatus.${quote.status}`)}
                      </StatusBadge>
                    </td>
                    <td className="px-1 py-2.5">
                      <RowMenu
                        items={[
                          { id: "open", label: t("historyTabs.openQuote") },
                          { id: "duplicate", label: t("historyTabs.duplicateQuote") },
                          {
                            id: "send",
                            label: t("historyTabs.sendQuote"),
                            disabled: !["draft", "sent"].includes(quote.status),
                          },
                          {
                            id: "invoice",
                            label: t("historyTabs.createInvoice"),
                            disabled: quote.status !== "accepted",
                          },
                        ]}
                        label={t("actions.more")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="space-y-2 py-2 md:hidden">
              {visible.map((quote) => (
                <li
                  className="rounded-[10px] bg-[#f7faff] px-3 py-2.5 ring-1 ring-[#e8eef6]"
                  key={quote.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-[#24334c]">{quote.number}</p>
                    <StatusBadge size="xs" tone={quoteStatusTone(quote.status)}>
                      {t(`quoteStatus.${quote.status}`)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-[11px] text-[#7d8aa0]">
                    {formatShortDate(quote.date)}
                  </p>
                  <p className="mt-0.5 text-xs font-medium tabular-nums text-[#405069]">
                    {formatMoneyFromCents(quote.amountCents)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <ResourcePagination
            page={safePage}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
          />
        </>
      )}
    </div>
  );
}

export function CustomerInvoicesTab({
  customer,
  canCreate,
  onCreateInvoice,
}: {
  customer: CustomerRecord;
  canCreate: boolean;
  onCreateInvoice: () => void;
}) {
  const t = useTranslations("customers");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const invoices = useInvoices();
  const payments = useInvoicePayments();
  const rows = useMemo<CustomerInvoiceSummary[]>(() => {
    const fromStore = invoices
      .filter(
        (invoice) =>
          invoice.customerId === customer.id || invoice.customerName === customer.displayName,
      )
      .map((invoice) => {
        const listStatus = invoiceListStatus(invoice, payments, ledgerToday);
        const status: CustomerInvoiceStatus =
          listStatus === "to_validate" || listStatus === "all" ? "draft" : listStatus;
        return {
          id: invoice.id,
          number: invoiceDisplayNumber(invoice),
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          amountCents: invoiceTotals(invoice).ttcCents,
          status,
          quoteId: invoice.quoteId,
          quoteNumber: invoice.quoteId,
        };
      });
    if (fromStore.length === 0) return customer.invoices;
    const known = new Set(fromStore.map((item) => item.number));
    return [...fromStore, ...customer.invoices.filter((item) => !known.has(item.number))];
  }, [customer.displayName, customer.id, customer.invoices, invoices, payments]);
  const acceptedReady = hasAcceptedQuoteReady(customer);
  const canCreateNow = canCreate && acceptedReady;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResourceHeader
        action={
          <button
            className={cn(
              "action-motion inline-flex h-8 items-center gap-1 rounded-[8px] px-2.5 text-[11px] font-semibold",
              canCreateNow
                ? "soft-primary text-white"
                : "cursor-not-allowed bg-[#eef2f7] text-[#98a4b5]",
            )}
            disabled={!canCreateNow}
            title={
              !acceptedReady ? t("actions.invoiceAcceptedRequired") : undefined
            }
            type="button"
            onClick={onCreateInvoice}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            {t("actions.newInvoice")}
          </button>
        }
        count={rows.length}
        title={t("historyTabs.invoices")}
      />

      {rows.length === 0 ? (
        <CustomerHistoryEmpty
          action={
            canCreate ? (
              <button
                className={cn(
                  "action-motion inline-flex h-9 items-center gap-1 rounded-[9px] px-3 text-xs font-semibold",
                  canCreateNow
                    ? "soft-primary text-white"
                    : "cursor-not-allowed bg-[#eef2f7] text-[#98a4b5]",
                )}
                disabled={!canCreateNow}
                title={
                  !acceptedReady ? t("actions.invoiceAcceptedRequired") : undefined
                }
                type="button"
                onClick={onCreateInvoice}
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                {t("historyTabs.createInvoice")}
              </button>
            ) : null
          }
          body={t("historyTabs.invoicesEmptyBody")}
          icon={ReceiptText}
          title={t("historyTabs.invoicesEmptyTitle")}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="hidden w-full table-fixed text-left md:table">
              <thead>
                <tr className="text-[10px] font-semibold tracking-wide text-[#98a4b5] uppercase">
                  <th className="px-1 py-2 font-semibold">{t("history.number")}</th>
                  <th className="px-1 py-2 font-semibold">{t("history.issueDate")}</th>
                  <th className="hidden px-1 py-2 font-semibold lg:table-cell">
                    {t("history.dueDate")}
                  </th>
                  <th className="px-1 py-2 font-semibold">{t("history.amount")}</th>
                  <th className="px-1 py-2 font-semibold">{t("history.status")}</th>
                  <th className="w-10 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((invoice) => {
                  const locked = isInvoiceLocked(invoice.status);
                  return (
                    <tr
                      className="border-t border-[#eef2f7] transition-colors hover:bg-[#f7faff]"
                      key={invoice.id}
                    >
                      <td className="truncate px-1 py-2.5 text-xs font-semibold text-[#24334c]">
                        {invoice.id.startsWith("inv-") ? (
                          <Link className="text-[#044ce2]" href={`/factures?invoice=${invoice.id}`}>
                            {invoice.number}
                          </Link>
                        ) : (
                          invoice.number
                        )}
                      </td>
                      <td className="px-1 py-2.5 text-xs text-[#405069]">
                        {formatShortDate(invoice.issueDate)}
                      </td>
                      <td className="hidden px-1 py-2.5 text-xs text-[#405069] lg:table-cell">
                        {formatShortDate(invoice.dueDate)}
                      </td>
                      <td className="px-1 py-2.5 text-xs tabular-nums text-[#405069]">
                        {formatMoneyFromCents(invoice.amountCents)}
                      </td>
                      <td className="px-1 py-2.5">
                        <StatusBadge size="xs" tone={invoiceStatusTone(invoice.status)}>
                          {t(`invoiceStatus.${invoice.status}`)}
                        </StatusBadge>
                      </td>
                      <td className="px-1 py-2.5">
                        <RowMenu
                          items={[
                            { id: "open", label: t("historyTabs.openInvoice") },
                            { id: "pdf", label: t("historyTabs.viewPdf") },
                            { id: "email", label: t("historyTabs.sendEmail") },
                            {
                              id: "pay",
                              label: t("actions.recordPayment"),
                              disabled: !["validated", "unpaid", "sent", "partial", "overdue"].includes(
                                invoice.status,
                              ),
                            },
                            ...(locked
                              ? []
                              : [{ id: "edit", label: t("historyTabs.editInvoice") }]),
                          ]}
                          label={t("actions.more")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="space-y-2 py-2 md:hidden">
              {visible.map((invoice) => (
                <li
                  className="rounded-[10px] bg-[#f7faff] px-3 py-2.5 ring-1 ring-[#e8eef6]"
                  key={invoice.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-[#24334c]">{invoice.number}</p>
                    <StatusBadge size="xs" tone={invoiceStatusTone(invoice.status)}>
                      {t(`invoiceStatus.${invoice.status}`)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-[11px] text-[#7d8aa0]">
                    {formatShortDate(invoice.issueDate)}
                  </p>
                  <p className="mt-0.5 text-xs font-medium tabular-nums text-[#405069]">
                    {formatMoneyFromCents(invoice.amountCents)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <ResourcePagination
            page={safePage}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
          />
        </>
      )}
    </div>
  );
}

export function CustomerPaymentsTab({
  customer,
  canRecord,
  onRecordPayment,
}: {
  customer: CustomerRecord;
  canRecord: boolean;
  onRecordPayment: () => void;
}) {
  const t = useTranslations("customers");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const invoices = useInvoices();
  const storePayments = useInvoicePayments();
  const rows = useMemo(() => {
    const fromStore = invoices
      .filter(
        (invoice) =>
          invoice.customerId === customer.id || invoice.customerName === customer.displayName,
      )
      .flatMap((invoice) =>
        storePayments
          .filter((payment) => payment.invoiceId === invoice.id)
          .map((payment) => ({
            id: payment.id,
            reference: payment.reference,
            date: payment.date,
            amountCents: payment.amountCents,
            method: payment.method,
            invoiceNumber: invoiceDisplayNumber(invoice),
            invoiceId: invoice.id,
            status: payment.status,
          })),
      );
    if (fromStore.length === 0) return customer.payments;
    const known = new Set(fromStore.map((item) => item.reference ?? item.id));
    return [
      ...fromStore,
      ...customer.payments.filter((item) => !known.has(item.reference ?? item.id)),
    ];
  }, [customer.displayName, customer.id, customer.payments, invoices, storePayments]);
  const eligible = hasEligibleInvoiceForPayment(customer);
  const canRecordNow = canRecord && eligible;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResourceHeader
        action={
          <button
            className={cn(
              "action-motion inline-flex h-8 items-center gap-1 rounded-[8px] px-2.5 text-[11px] font-semibold",
              canRecordNow
                ? "soft-primary text-white"
                : "cursor-not-allowed bg-[#eef2f7] text-[#98a4b5]",
            )}
            disabled={!canRecordNow}
            title={!eligible ? t("actions.paymentHint") : undefined}
            type="button"
            onClick={onRecordPayment}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            {t("actions.recordPayment")}
          </button>
        }
        count={rows.length}
        title={t("historyTabs.payments")}
      />

      {rows.length === 0 ? (
        <CustomerHistoryEmpty
          body={t("historyTabs.paymentsEmptyBody")}
          icon={WalletCards}
          title={t("historyTabs.paymentsEmptyTitle")}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="hidden w-full table-fixed text-left md:table">
              <thead>
                <tr className="text-[10px] font-semibold tracking-wide text-[#98a4b5] uppercase">
                  <th className="px-1 py-2 font-semibold">{t("history.date")}</th>
                  <th className="px-1 py-2 font-semibold">{t("history.reference")}</th>
                  <th className="px-1 py-2 font-semibold">{t("history.amount")}</th>
                  <th className="px-1 py-2 font-semibold">{t("history.method")}</th>
                  <th className="px-1 py-2 font-semibold">{t("history.status")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((payment) => (
                  <tr
                    className="border-t border-[#eef2f7] transition-colors hover:bg-[#f7faff]"
                    key={payment.id}
                  >
                    <td className="px-1 py-2.5 text-xs text-[#405069]">
                      {formatShortDate(payment.date)}
                    </td>
                    <td className="min-w-0 px-1 py-2.5">
                      <p className="truncate text-xs font-semibold text-[#24334c]">
                        {payment.reference ?? payment.id}
                      </p>
                      <p className="truncate text-[10px] text-[#98a4b5]">
                        {payment.invoiceNumber}
                      </p>
                    </td>
                    <td className="px-1 py-2.5 text-xs tabular-nums text-[#405069]">
                      {formatMoneyFromCents(payment.amountCents)}
                    </td>
                    <td className="px-1 py-2.5 text-xs text-[#405069]">
                      {t(`methods.${payment.method}`)}
                    </td>
                    <td className="px-1 py-2.5">
                      <StatusBadge
                        size="xs"
                        tone={paymentStatusTone(payment.status ?? "completed")}
                      >
                        {t(`paymentStatus.${payment.status ?? "completed"}`)}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="space-y-2 py-2 md:hidden">
              {visible.map((payment) => (
                <li
                  className="rounded-[10px] bg-[#f7faff] px-3 py-2.5 ring-1 ring-[#e8eef6]"
                  key={payment.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#24334c]">
                        {payment.reference ?? payment.id}
                      </p>
                      <p className="truncate text-[10px] text-[#98a4b5]">
                        {payment.invoiceNumber}
                      </p>
                    </div>
                    <StatusBadge
                      size="xs"
                      tone={paymentStatusTone(payment.status ?? "completed")}
                    >
                      {t(`paymentStatus.${payment.status ?? "completed"}`)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-[11px] text-[#7d8aa0]">
                    {formatShortDate(payment.date)} · {t(`methods.${payment.method}`)}
                  </p>
                  <p className="mt-0.5 text-xs font-medium tabular-nums text-[#405069]">
                    {formatMoneyFromCents(payment.amountCents)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <ResourcePagination
            page={safePage}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
          />
        </>
      )}
    </div>
  );
}
