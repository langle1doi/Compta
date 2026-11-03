"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PageSizeSelect } from "@/components/compte/page-size-select";
import { SoftSelect } from "@/components/compte/soft-select";
import { StatusBadge } from "@/components/dashboard/tone";
import { FormSheet } from "@/components/forms/form-sheet";
import {
  invoiceDisplayNumber,
  isInvoiceEligibleForPayment,
  remainingCentsFor,
  type BankTransaction,
  type InvoicePayment,
  type InvoiceRecord,
  type PaymentActivity,
} from "@/features/invoices/model";
import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  computeMatchReasons,
  deriveQueueStatus,
  emptyReconciliationFilters,
  filterAndSortBankTransactions,
  matchConfidenceFor,
  RECONCILIATION_AMOUNT_FILTERS,
  RECONCILIATION_CONFIDENCE_FILTERS,
  RECONCILIATION_PERIOD_FILTERS,
  RECONCILIATION_SORT_PRESETS,
  RECONCILIATION_STATUS_FILTERS,
  type ReconciliationFilters,
  type ReconciliationQueueStatus,
} from "../reconciliation";
import { reconciliationQueueStatusTone } from "../status";

const pageSizeOptions = [10, 25, 50] as const;

export function ReconciliationQueueSheet({
  open,
  transactions,
  invoices,
  payments,
  activities,
  canReconcile,
  onClose,
  onMatch,
  onMatchInvoice,
  onReview,
  onViewPayment,
}: {
  open: boolean;
  transactions: BankTransaction[];
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  activities: PaymentActivity[];
  canReconcile: boolean;
  onClose: () => void;
  onMatch: (id: string) => void;
  onMatchInvoice: (transactionId: string, invoiceId: string) => void;
  onReview: (id: string) => void;
  onViewPayment: (paymentId: string) => void;
}) {
  const t = useTranslations("payments.queueFull");
  const queueT = useTranslations("payments.queue");
  const [filters, setFilters] = useState<ReconciliationFilters>(emptyReconciliationFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setFilters(emptyReconciliationFilters);
      setPage(0);
      setSelectedIds([]);
      setDetailId(null);
    }
    wasOpen.current = open;
  }, [open]);

  const invoicesById = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );

  const filtered = useMemo(
    () => filterAndSortBankTransactions(transactions, invoicesById, payments, filters),
    [filters, invoicesById, payments, transactions],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeFrom = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeTo = Math.min(filtered.length, (safePage + 1) * pageSize);
  const allChecked = visible.length > 0 && visible.every((item) => selectedIds.includes(item.id));
  const detailTx = detailId ? transactions.find((item) => item.id === detailId) ?? null : null;

  function patchFilters(patch: Partial<ReconciliationFilters>) {
    setPage(0);
    setFilters((current) => ({ ...current, ...patch }));
  }

  function relatedInvoice(transaction: BankTransaction) {
    const id = transaction.suggestedInvoiceId ?? transaction.matchedInvoiceId;
    return id ? invoicesById.get(id) : undefined;
  }

  function queueAction(transaction: BankTransaction, status: ReconciliationQueueStatus) {
    if (status === "matched") {
      if (transaction.matchedPaymentId) {
        onViewPayment(transaction.matchedPaymentId);
        return;
      }
      setDetailId(transaction.id);
      return;
    }
    if (status === "cannot_match") {
      setDetailId(transaction.id);
      return;
    }
    if (status === "suggested_match") {
      onMatch(transaction.id);
      return;
    }
    onReview(transaction.id);
  }

  return (
    <>
      <FormSheet
        closeLabel={t("close")}
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        description={t("subtitle")}
        open={open}
        title={t("title")}
        widthClassName="sm:max-w-[min(100%,1040px)]"
        zIndexClassName="z-[65]"
        onClose={onClose}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-[#edf2f8] px-3.5 py-3 sm:px-5">
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t("search")}</span>
              <input
                className="compte-search-input soft-input h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c] outline-none"
                onChange={(event) => patchFilters({ query: event.target.value })}
                placeholder={t("searchPlaceholder")}
                type="search"
                value={filters.query}
              />
            </label>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto lg:grid-cols-4">
              <SoftSelect
                hideLabel
                label={t("filters.status")}
                options={RECONCILIATION_STATUS_FILTERS.map((value) => ({
                  value,
                  label: t(`status.${value}`),
                }))}
                triggerClassName="h-10"
                value={filters.status}
                onChange={(value) =>
                  patchFilters({ status: value as ReconciliationFilters["status"] })
                }
              />
              <SoftSelect
                hideLabel
                label={t("filters.confidence")}
                options={RECONCILIATION_CONFIDENCE_FILTERS.map((value) => ({
                  value,
                  label: t(`confidence.${value}`),
                }))}
                triggerClassName="h-10"
                value={filters.confidence}
                onChange={(value) =>
                  patchFilters({ confidence: value as ReconciliationFilters["confidence"] })
                }
              />
              <SoftSelect
                hideLabel
                label={t("filters.period")}
                options={RECONCILIATION_PERIOD_FILTERS.map((value) => ({
                  value,
                  label: t(`period.${value}`),
                }))}
                triggerClassName="h-10"
                value={filters.period}
                onChange={(value) =>
                  patchFilters({ period: value as ReconciliationFilters["period"] })
                }
              />
              <SoftSelect
                hideLabel
                label={t("filters.sort")}
                options={RECONCILIATION_SORT_PRESETS.map((value) => ({
                  value,
                  label: t(`sort.${value}`),
                }))}
                triggerClassName="h-10"
                value={filters.sort}
                onChange={(value) =>
                  patchFilters({ sort: value as ReconciliationFilters["sort"] })
                }
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SoftSelect
              hideLabel
              className="w-full max-w-[220px]"
              label={t("filters.amount")}
              options={RECONCILIATION_AMOUNT_FILTERS.map((value) => ({
                value,
                label: t(`amount.${value}`),
              }))}
              triggerClassName="h-9"
              value={filters.amount}
              onChange={(value) =>
                patchFilters({ amount: value as ReconciliationFilters["amount"] })
              }
            />
            {filters.query ||
            filters.status !== "all" ||
            filters.period !== "any" ||
            filters.amount !== "all" ||
            filters.confidence !== "all" ||
            filters.sort !== "newest" ? (
              <button
                className="action-motion soft-button h-9 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
                onClick={() => {
                  setFilters(emptyReconciliationFilters);
                  setPage(0);
                }}
                type="button"
              >
                {t("clearFilters")}
              </button>
            ) : null}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-[#24334c]">{t("emptyTitle")}</p>
            <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">{t("emptyBody")}</p>
          </div>
        ) : (
          <>
            <div className="hidden min-h-0 flex-1 overflow-auto lg:block">
              <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-left">
                <colgroup>
                  <col style={{ width: 36 }} />
                  <col style={{ width: 100 }} />
                  <col />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 100 }} />
                </colgroup>
                <thead className="dashboard-list__head sticky top-0 z-[1] bg-white">
                  <tr>
                    <th className="min-w-0 overflow-hidden">
                      <input
                        aria-label={t("selectAll")}
                        checked={allChecked}
                        className="h-3.5 w-3.5 accent-[#044ce2]"
                        type="checkbox"
                        onChange={() => {
                          setSelectedIds((current) =>
                            allChecked
                              ? current.filter((id) => !visible.some((item) => item.id === id))
                              : [...new Set([...current, ...visible.map((item) => item.id)])],
                          );
                        }}
                      />
                    </th>
                    <th className="min-w-0 overflow-hidden">{t("columns.date")}</th>
                    <th className="min-w-0 overflow-hidden">{t("columns.bank")}</th>
                    <th className="min-w-0 overflow-hidden text-right">{t("columns.amount")}</th>
                    <th className="min-w-0 overflow-hidden">{t("columns.invoice")}</th>
                    <th className="min-w-0 overflow-hidden">{t("columns.reason")}</th>
                    <th className="min-w-0 overflow-hidden">{t("columns.status")}</th>
                    <th className="min-w-0 overflow-hidden">{t("columns.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((transaction) => {
                    const invoice = relatedInvoice(transaction);
                    const status = deriveQueueStatus(transaction, invoice, payments);
                    const reasons = computeMatchReasons(transaction, invoice, payments);
                    const remaining = invoice ? remainingCentsFor(invoice, payments) : 0;
                    const checked = selectedIds.includes(transaction.id);
                    return (
                      <tr
                        className={cn(
                          "dashboard-list__row cursor-pointer",
                          detailId === transaction.id && "bg-[#eef4ff]",
                        )}
                        key={transaction.id}
                        onClick={() => setDetailId(transaction.id)}
                      >
                        <td className="min-w-0 overflow-hidden">
                          <input
                            aria-label={t("selectRow", { label: transaction.label })}
                            checked={checked}
                            className="h-3.5 w-3.5 accent-[#044ce2]"
                            type="checkbox"
                            onChange={() => {
                              setSelectedIds((current) =>
                                current.includes(transaction.id)
                                  ? current.filter((id) => id !== transaction.id)
                                  : [...current, transaction.id],
                              );
                            }}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </td>
                        <td className="min-w-0 overflow-hidden">
                          <DateCell date={transaction.date} />
                        </td>
                        <td className="min-w-0 overflow-hidden">
                          <BankCell transaction={transaction} />
                        </td>
                        <td className="min-w-0 overflow-hidden text-right">
                          <span className="dashboard-list__amount tabular-nums">
                            {formatMoneyFromCents(transaction.amountCents)}
                          </span>
                        </td>
                        <td className="min-w-0 overflow-hidden">
                          <InvoiceCell invoice={invoice} remainingCents={remaining} status={status} />
                        </td>
                        <td className="min-w-0 overflow-hidden">
                          <p className="dashboard-list__secondary line-clamp-2" title={reasons.map((r) => t(`reasons.${r}`)).join(" · ")}>
                            {reasons.slice(0, 2).map((reason) => t(`reasons.${reason}`)).join(" · ")}
                          </p>
                        </td>
                        <td className="min-w-0 overflow-hidden">
                          <StatusBadge size="xs" tone={reconciliationQueueStatusTone[status]}>
                            {t(`status.${status}`)}
                          </StatusBadge>
                        </td>
                        <td className="min-w-0 overflow-hidden">
                          {canReconcile || status === "matched" || status === "cannot_match" ? (
                            <button
                              className="action-motion soft-button h-7 rounded-[8px] px-2 text-[11px] font-semibold text-[#044ce2]"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                queueAction(transaction, status);
                              }}
                            >
                              {status === "matched" || status === "cannot_match"
                                ? t("actions.view")
                                : status === "suggested_match"
                                  ? queueT("match")
                                  : queueT("review")}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 lg:hidden">
              {visible.map((transaction) => {
                const invoice = relatedInvoice(transaction);
                const status = deriveQueueStatus(transaction, invoice, payments);
                const remaining = invoice ? remainingCentsFor(invoice, payments) : 0;
                return (
                  <li className="dashboard-card px-3 py-3" key={transaction.id}>
                    <button
                      className="w-full min-w-0 text-left"
                      type="button"
                      onClick={() => setDetailId(transaction.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="dashboard-list__primary truncate" title={transaction.label}>
                          {transaction.label}
                        </span>
                        <StatusBadge size="xs" tone={reconciliationQueueStatusTone[status]}>
                          {t(`status.${status}`)}
                        </StatusBadge>
                      </div>
                      <strong className="dashboard-list__amount mt-1 block">
                        {formatMoneyFromCents(transaction.amountCents)}
                      </strong>
                      <p className="dashboard-list__secondary mt-1">
                        <DateCell date={transaction.date} />
                      </p>
                      {invoice ? (
                        <p className="dashboard-list__secondary mt-1">
                          {t("mobile.suggested", {
                            invoice: invoiceDisplayNumber(invoice),
                            remaining: formatMoneyFromCents(remaining),
                          })}
                        </p>
                      ) : (
                        <p className="dashboard-list__secondary mt-1">{t("invoice.none")}</p>
                      )}
                    </button>
                    {(canReconcile || status === "matched" || status === "cannot_match") && (
                      <div className="mt-2 flex justify-end">
                        <button
                          className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-xs font-semibold text-[#044ce2]"
                          type="button"
                          onClick={() => queueAction(transaction, status)}
                        >
                          {status === "matched" || status === "cannot_match"
                            ? t("actions.view")
                            : status === "suggested_match"
                              ? queueT("match")
                              : queueT("review")}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#edf2f8] px-3.5 py-2 sm:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-[11px] text-[#7d8aa0]">
              {t("pagination.summary", {
                from: rangeFrom,
                to: rangeTo,
                total: filtered.length,
              })}
            </p>
            <PageSizeSelect
              formatOption={(count) =>
                t("pagination.rowsPerPage", { count })
              }
              label={t("pagination.pageSize")}
              options={pageSizeOptions}
              value={pageSize}
              onChange={(size) => {
                setPage(0);
                setPageSize(size);
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078] disabled:opacity-40"
              disabled={safePage === 0}
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              {t("pagination.prev")}
            </button>
            <span className="min-w-[3.5rem] text-center text-[11px] font-semibold tabular-nums text-[#516078]">
              {safePage + 1}/{pageCount}
            </span>
            <button
              className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078] disabled:opacity-40"
              disabled={safePage >= pageCount - 1}
              type="button"
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            >
              {t("pagination.next")}
            </button>
          </div>
        </footer>
      </FormSheet>

      <ReconciliationDetailSheet
        activities={activities}
        invoice={detailTx ? relatedInvoice(detailTx) : undefined}
        invoices={invoices}
        open={detailTx !== null}
        payments={payments}
        transaction={detailTx}
        onClose={() => setDetailId(null)}
        onConfirm={(invoiceId) => {
          if (!detailTx) return;
          const transactionId = detailTx.id;
          setDetailId(null);
          onMatchInvoice(transactionId, invoiceId);
        }}
        onReview={() => {
          if (!detailTx) return;
          const transactionId = detailTx.id;
          setDetailId(null);
          onReview(transactionId);
        }}
      />
    </>
  );
}

function DateCell({ date }: { date: string }) {
  const locale = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <span className="dashboard-list__secondary tabular-nums">
      {dateFmt.format(new Date(`${date}T00:00:00`))}
    </span>
  );
}

function BankCell({ transaction }: { transaction: BankTransaction }) {
  const t = useTranslations("payments.queueFull");
  const locale = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const secondary = [
    dateFmt.format(new Date(`${transaction.date}T00:00:00`)),
    t("bankTransfer"),
    transaction.reference,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0">
      <p className="dashboard-list__primary truncate" title={transaction.label}>
        {transaction.label}
      </p>
      <p className="dashboard-list__secondary truncate" title={secondary}>
        {secondary}
      </p>
    </div>
  );
}

function InvoiceCell({
  invoice,
  remainingCents,
  status,
}: {
  invoice: InvoiceRecord | undefined;
  remainingCents: number;
  status: ReconciliationQueueStatus;
}) {
  const t = useTranslations("payments.queueFull");
  if (!invoice) {
    return (
      <div className="min-w-0">
        <p className="dashboard-list__primary">{t("invoice.noneTitle")}</p>
        <p className="dashboard-list__secondary">{t("invoice.none")}</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="dashboard-list__primary tabular-nums">{invoiceDisplayNumber(invoice)}</p>
      <p className="dashboard-list__secondary truncate">{invoice.customerName}</p>
      <p className="dashboard-list__secondary">
        {status === "matched"
          ? t("invoice.matched")
          : t("invoice.remaining", { amount: formatMoneyFromCents(remainingCents) })}
      </p>
    </div>
  );
}

function ReconciliationDetailSheet({
  open,
  transaction,
  invoice,
  invoices,
  payments,
  activities,
  onClose,
  onConfirm,
  onReview,
}: {
  open: boolean;
  transaction: BankTransaction | null;
  invoice: InvoiceRecord | undefined;
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  activities: PaymentActivity[];
  onClose: () => void;
  onConfirm: (invoiceId: string) => void;
  onReview: () => void;
}) {
  const t = useTranslations("payments.queueFull");
  const queueT = useTranslations("payments.queue");
  const reviewT = useTranslations("payments.review");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [boundId, setBoundId] = useState(transaction?.id ?? "");
  const [cachedTx, setCachedTx] = useState(transaction);
  const [cachedInvoice, setCachedInvoice] = useState(invoice);
  const txId = transaction?.id ?? "";
  if (transaction && (cachedTx?.id !== transaction.id || cachedInvoice?.id !== invoice?.id)) {
    setCachedTx(transaction);
    setCachedInvoice(invoice);
  }
  if (txId && boundId !== txId) {
    setBoundId(txId);
    setSearching(false);
    setQuery("");
    setPickedId("");
    setListOpen(false);
  }
  const shown = transaction ?? cachedTx;
  const shownInvoice = transaction ? invoice : cachedInvoice;
  const locale = useLocale();
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

  const eligible = useMemo(
    () => invoices.filter((item) => isInvoiceEligibleForPayment(item, payments)),
    [invoices, payments],
  );
  const filteredInvoices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return eligible;
    return eligible.filter((item) => {
      const remaining = remainingCentsFor(item, payments);
      const haystack = [
        invoiceDisplayNumber(item),
        item.number ?? "",
        item.customerName,
        item.reference ?? "",
        item.poNumber ?? "",
        formatMoneyFromCents(remaining),
        String(remaining / 100),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [eligible, payments, query]);

  const status = shown ? deriveQueueStatus(shown, shownInvoice, payments) : "unmatched";
  const reasons = shown ? computeMatchReasons(shown, shownInvoice, payments) : [];
  const confidence = shown ? matchConfidenceFor(shown, shownInvoice, payments) : 0;
  const remaining = shownInvoice ? remainingCentsFor(shownInvoice, payments) : 0;
  const relatedActivities = shown
    ? activities.filter((item) => item.bankTransactionId === shown.id)
    : [];

  return (
    <FormSheet
      closeLabel={t("close")}
      description={shown?.label}
      footer={
        !shown || status === "matched" || status === "cannot_match" ? (
          shown && status === "cannot_match" ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
                type="button"
                onClick={onClose}
              >
                {t("close")}
              </button>
            </div>
          ) : null
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
              type="button"
              onClick={onClose}
            >
              {t("close")}
            </button>
            {shownInvoice && !searching ? (
              <button
                className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#044ce2]"
                type="button"
                onClick={() => {
                  setSearching(true);
                  setQuery("");
                  setPickedId("");
                  setListOpen(true);
                }}
              >
                {reviewT("searchAnother")}
              </button>
            ) : null}
            <button
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-40"
              disabled={searching && !pickedId}
              type="button"
              onClick={() => {
                if (searching) {
                  if (pickedId) onConfirm(pickedId);
                  return;
                }
                if (shownInvoice) {
                  onConfirm(shownInvoice.id);
                  return;
                }
                onReview();
              }}
            >
              {searching ? reviewT("confirm") : status === "suggested_match" ? queueT("match") : queueT("review")}
            </button>
          </div>
        )
      }
      open={open}
      title={t("detail.title")}
      widthClassName="sm:max-w-[440px]"
      zIndexClassName="z-[75]"
      onClose={onClose}
    >
      {shown ? <div className="space-y-3">
        <section className="rounded-[10px] border border-[#edf2f8] px-3 py-3">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
            {t("detail.bank")}
          </p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <DetailRow
              label={t("columns.date")}
              value={dateFmt.format(new Date(`${shown.date}T00:00:00`))}
            />
            <DetailRow
              label={t("columns.amount")}
              value={formatMoneyFromCents(shown.amountCents)}
            />
            <DetailRow label={t("columns.bank")} value={shown.label} />
            <DetailRow label={t("detail.reference")} value={shown.reference ?? "—"} />
            <DetailRow label={t("detail.account")} value={shown.sourceAccount ?? "—"} />
            <DetailRow
              label={t("columns.status")}
              value={
                <StatusBadge size="xs" tone={reconciliationQueueStatusTone[status]}>
                  {t(`status.${status}`)}
                </StatusBadge>
              }
            />
          </dl>
        </section>

        {searching ? (
          <section className="space-y-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-[#66758d]">{reviewT("search")}</span>
              <input
                autoFocus
                className="compte-search-input soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c] outline-none"
                placeholder={reviewT("searchPlaceholder")}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPickedId("");
                  setListOpen(true);
                }}
                onFocus={(event) => {
                  if (pickedId) event.currentTarget.select();
                }}
              />
            </label>
            {!listOpen ? null : filteredInvoices.length === 0 ? (
              <p className="py-4 text-center text-xs text-[#7d8aa0]">{reviewT("noInvoices")}</p>
            ) : (
              <ul className="dashboard-scroll max-h-[240px] overflow-y-auto overscroll-contain rounded-[9px] border border-[#edf2f8]">
                {filteredInvoices.map((item) => {
                  const itemRemaining = remainingCentsFor(item, payments);
                  return (
                    <li key={item.id}>
                      <button
                        className="flex w-full min-w-0 flex-col items-start px-3 py-2 text-left"
                        type="button"
                        onClick={() => {
                          setPickedId(item.id);
                          setQuery(
                            `${invoiceDisplayNumber(item)} · ${item.customerName} · ${formatMoneyFromCents(itemRemaining)}`,
                          );
                          setListOpen(false);
                        }}
                      >
                        <span className="dashboard-list__primary tabular-nums">
                          {invoiceDisplayNumber(item)}
                        </span>
                        <span className="dashboard-list__secondary truncate">
                          {item.customerName}
                          {item.poNumber ? ` · ${item.poNumber}` : ""}
                          {item.reference ? ` · ${item.reference}` : ""}
                        </span>
                        <span className="dashboard-list__secondary tabular-nums">
                          {formatMoneyFromCents(itemRemaining)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <section className="rounded-[10px] border border-[#edf2f8] px-3 py-3">
            <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
              {t("detail.suggested")}
            </p>
            {shownInvoice ? (
              <dl className="mt-2 space-y-1.5 text-sm">
                <DetailRow label={t("detail.invoice")} value={invoiceDisplayNumber(shownInvoice)} />
                <DetailRow label={t("detail.customer")} value={shownInvoice.customerName} />
                <DetailRow
                  label={t("detail.remaining")}
                  value={formatMoneyFromCents(remaining)}
                />
                <DetailRow label={t("detail.confidence")} value={`${confidence}%`} />
                <DetailRow
                  label={t("columns.reason")}
                  value={reasons.map((reason) => t(`reasons.${reason}`)).join(" · ")}
                />
              </dl>
            ) : (
              <p className="mt-2 text-xs text-[#7d8aa0]">{t("invoice.none")}</p>
            )}
          </section>
        )}

        <section className="rounded-[10px] border border-[#edf2f8] px-3 py-3">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
            {t("detail.activity")}
          </p>
          {relatedActivities.length === 0 ? (
            <p className="mt-2 text-xs text-[#7d8aa0]">{t("detail.activityEmpty")}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {relatedActivities.map((item) => (
                <li key={item.id}>
                  <p className="text-xs font-semibold text-[#24334c]">
                    {item.kind === "matched"
                      ? t("activity.matched", { invoice: item.invoiceNumber ?? "" })
                      : item.kind === "reviewed"
                        ? t("activity.reviewed")
                        : t("activity.detected")}
                  </p>
                  <p className="text-[11px] text-[#7d8aa0]">
                    {dateTime.format(new Date(item.at))} · {item.actorName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div> : null}
    </FormSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <dt className="shrink-0 text-[11px] text-[#7d8aa0]">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-medium text-[#24334c]">{value}</dd>
    </div>
  );
}
