"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/dashboard/tone";
import { FormSheet } from "@/components/forms/form-sheet";
import {
  invoiceDisplayNumber,
  remainingCentsFor,
  type BankTransaction,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { formatMoneyFromCents } from "@/lib/money";

import { computeMatchReasons, deriveQueueStatus } from "../reconciliation";
import { reconciliationQueueStatusTone } from "../status";

export function ReviewMatchSheet({
  open,
  transaction,
  invoices,
  payments,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  transaction: BankTransaction | null;
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (invoiceId: string) => void;
}) {
  const t = useTranslations("payments.review");
  const queueT = useTranslations("payments.queueFull");
  const locale = useLocale();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [listOpen, setListOpen] = useState(false);

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [locale],
  );

  const suggested = useMemo(() => {
    if (!transaction?.suggestedInvoiceId) return undefined;
    return invoices.find((item) => item.id === transaction.suggestedInvoiceId);
  }, [invoices, transaction]);

  const status = transaction ? deriveQueueStatus(transaction, suggested, payments) : "unmatched";
  const reviewReasons = transaction
    ? computeMatchReasons(transaction, suggested, payments)
    : [];

  const filteredInvoices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return invoices;
    return invoices.filter((item) => {
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
  }, [invoices, payments, query]);

  const selectedInvoice = invoices.find((item) => item.id === invoiceId);
  const canConfirmSuggested = Boolean(suggested) && !searching && !saving;
  const canConfirmSearch = searching && Boolean(selectedInvoice) && !saving;

  function invoiceOptionLabel(item: InvoiceRecord) {
    return `${invoiceDisplayNumber(item)} · ${item.customerName} · ${formatMoneyFromCents(remainingCentsFor(item, payments))}`;
  }

  function openSearch() {
    setSearching(true);
    setQuery("");
    setInvoiceId("");
    setListOpen(true);
  }

  function keepUnmatched() {
    setSearching(false);
    setQuery("");
    setInvoiceId("");
    setListOpen(false);
    onClose();
  }

  function selectInvoice(item: InvoiceRecord) {
    setInvoiceId(item.id);
    setQuery(invoiceOptionLabel(item));
    setListOpen(false);
  }

  function confirmSuggested() {
    if (!suggested || saving) return;
    onConfirm(suggested.id);
  }

  function confirmSelected() {
    if (!selectedInvoice || saving) return;
    onConfirm(selectedInvoice.id);
  }

  return (
    <FormSheet
      closeLabel={t("close")}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
            onClick={onClose}
            type="button"
          >
            {t("close")}
          </button>
          <button
            className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
            onClick={keepUnmatched}
            type="button"
          >
            {t("keepUnmatched")}
          </button>
          {searching ? (
            <button
              aria-busy={saving}
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-40"
              disabled={!canConfirmSearch}
              onClick={confirmSelected}
              type="button"
            >
              {saving ? t("saving") : t("confirm")}
            </button>
          ) : suggested ? (
            <>
              <button
                className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#044ce2]"
                onClick={openSearch}
                type="button"
              >
                {t("searchAnother")}
              </button>
              <button
                aria-busy={saving}
                className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-40"
                disabled={!canConfirmSuggested}
                onClick={confirmSuggested}
                type="button"
              >
                {saving ? t("saving") : t("confirm")}
              </button>
            </>
          ) : (
            <button
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
              onClick={openSearch}
              type="button"
            >
              {t("searchAndLink")}
            </button>
          )}
        </div>
      }
      open={open}
      title={t("title")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[80]"
      onClose={onClose}
    >
      {!transaction ? null : (
        <div className="space-y-3">
          <section className="rounded-[10px] border border-[#edf2f8] px-3 py-3">
            <dl className="space-y-1.5 text-sm">
              <DetailRow label={t("amount")} value={formatMoneyFromCents(transaction.amountCents)} />
              <DetailRow
                label={t("date")}
                value={dateFmt.format(new Date(`${transaction.date}T00:00:00`))}
              />
              <DetailRow label={t("label")} value={transaction.label} />
              <DetailRow label={t("reference")} value={transaction.reference?.trim() || "—"} />
              <DetailRow
                label={t("status")}
                value={
                  <StatusBadge size="xs" tone={reconciliationQueueStatusTone[status]}>
                    {queueT(`status.${status}`)}
                  </StatusBadge>
                }
              />
              <DetailRow
                label={t("reason")}
                value={
                  reviewReasons.length > 0
                    ? reviewReasons.map((reason) => queueT(`reasons.${reason}`)).join(" · ")
                    : "—"
                }
              />
            </dl>
          </section>

          {!searching && suggested ? (
            <section className="rounded-[10px] border border-[#edf2f8] px-3 py-3">
              <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
                {t("suggestedTitle")}
              </p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <DetailRow label={t("invoice")} value={invoiceDisplayNumber(suggested)} />
                <DetailRow label={t("customer")} value={suggested.customerName} />
                <DetailRow
                  label={t("remaining")}
                  value={formatMoneyFromCents(remainingCentsFor(suggested, payments))}
                />
                <DetailRow
                  label={t("matchReason")}
                  value={computeMatchReasons(transaction, suggested, payments)
                    .map((reason) => queueT(`reasons.${reason}`))
                    .join(" · ")}
                />
              </dl>
            </section>
          ) : null}

          {searching ? (
            <section className="space-y-2">
              <label className="block">
                <span className="text-[11px] font-semibold text-[#66758d]">{t("search")}</span>
                <input
                  autoFocus
                  className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c]"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setInvoiceId("");
                    setListOpen(true);
                  }}
                  onFocus={(event) => {
                    if (invoiceId) event.currentTarget.select();
                  }}
                  placeholder={t("searchPlaceholder")}
                  type="search"
                  value={query}
                />
              </label>
              {!listOpen ? null : filteredInvoices.length === 0 ? (
                <p className="py-4 text-center text-xs text-[#7d8aa0]">{t("noInvoices")}</p>
              ) : (
                <ul className="dashboard-scroll max-h-[240px] overflow-y-auto overscroll-contain rounded-[9px] border border-[#edf2f8]">
                  {filteredInvoices.map((item) => {
                    const remaining = remainingCentsFor(item, payments);
                    return (
                      <li key={item.id}>
                        <button
                          className="flex w-full min-w-0 flex-col items-start px-3 py-2 text-left"
                          type="button"
                          onClick={() => selectInvoice(item)}
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
                            {formatMoneyFromCents(remaining)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {error ? <p className="text-xs font-medium text-[#c9564f]">{error}</p> : null}
        </div>
      )}
    </FormSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <dt className="shrink-0 text-[11px] text-[#7d8aa0]">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-medium break-words text-[#24334c]">{value}</dd>
    </div>
  );
}
