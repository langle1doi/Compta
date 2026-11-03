"use client";

import { Mail, MoreHorizontal, ReceiptText, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
  TOP_TABS_ACTIVE_LAYOUT_ID,
} from "@/components/compte/animated-selection";
import { AmountInput } from "@/components/compte/amount-input";
import { SoftDatePicker } from "@/components/compte/soft-date-picker";
import { SoftSelect } from "@/components/compte/soft-select";
import { ActivityFeedItem } from "@/components/dashboard/activity-feed-item";
import { IconTile, StatusBadge } from "@/components/dashboard/tone";
import type { PaymentTerms } from "@/features/customers/types";
import { useCan } from "@/features/settings/can";
import { Link } from "@/i18n/navigation";
import { formatMoneyFromCents, parseAmount, sanitizeIntegerInput } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  derivePaymentStatus,
  invoiceDisplayNumber,
  invoiceListStatus,
  invoiceTotals,
  invoiceVatBreakdown,
  isInvoiceLocked,
  paidCentsFor,
  type InvoiceDraftPatch,
  type InvoiceLine,
  type InvoicePayment,
  type InvoiceRecord,
} from "../model";
import { invoiceListStatusTone } from "../status";
import { ledgerToday } from "@/features/quotes/model";

const tabs = ["details", "items", "payments", "activity"] as const;
type PanelTab = (typeof tabs)[number];

const PAYMENT_TERMS: PaymentTerms[] = [
  "upon_receipt",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
];

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "CHF", "RON"] as const;

function draftsEqual(left: InvoiceDraftPatch, right: InvoiceDraftPatch) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toDraft(invoice: InvoiceRecord): InvoiceDraftPatch {
  return {
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paymentTerms: invoice.paymentTerms,
    poNumber: invoice.poNumber,
    reference: invoice.reference,
    lines: invoice.lines.map((line) => ({ ...line })),
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    currency: invoice.currency || "EUR",
  };
}

export function InvoiceDetailsPanel({
  invoice,
  payments,
  customers,
  canUpdate,
  canValidate,
  canSend,
  initialTab = "details",
  onClose,
  onDirtyChange,
  onSave,
  onCancel,
  onValidate,
  onDelete,
  onSend,
}: {
  invoice: InvoiceRecord;
  payments: InvoicePayment[];
  customers: Array<{ id: string; name: string }>;
  canUpdate: boolean;
  canValidate: boolean;
  canSend: boolean;
  initialTab?: PanelTab;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (patch: InvoiceDraftPatch) => void;
  onCancel: () => void;
  onValidate: () => void;
  onDelete: () => void;
  onSend: () => void;
}) {
  const t = useTranslations("invoices");
  const locale = useLocale();
  const canOpenQuote = useCan()("quote.read");
  const locked = isInvoiceLocked(invoice);
  const editable = !locked && canUpdate;
  const hasMoreActions = locked ? canSend : canUpdate;
  const [tab, setTab] = useState<PanelTab>(initialTab);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<InvoiceDraftPatch>(() => toDraft(invoice));
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [appliedKey, setAppliedKey] = useState(`${invoice.id}:${invoice.updatedAt}:${initialTab}`);
  const baseline = toDraft(invoice);
  const syncKey = `${invoice.id}:${invoice.updatedAt}:${initialTab}`;
  if (appliedKey !== syncKey) {
    setAppliedKey(syncKey);
    setDraft(toDraft(invoice));
    setPriceDrafts({});
    setTab(initialTab);
  }
  const dirty = !locked && !draftsEqual(draft, baseline);
  const listStatus = invoiceListStatus(invoice, payments, ledgerToday);
  const paymentStatus = derivePaymentStatus(invoice, payments, ledgerToday);
  const working: InvoiceRecord = locked ? invoice : { ...invoice, ...draft };
  const totals = invoiceTotals(working);
  const vatGroups = invoiceVatBreakdown(working);
  const paid = paidCentsFor(invoice.id, payments);
  const remaining = Math.max(0, totals.ttcCents - paid);
  const dateTime = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!moreOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  function patch(partial: Partial<InvoiceDraftPatch>) {
    if (!editable) return;
    setDraft((current) => ({ ...current, ...partial }));
  }

  function patchCurrency(value: string) {
    if (!canUpdate) return;
    setDraft((current) => ({ ...current, currency: value }));
    // Locked invoices have no Save footer — persist currency immediately.
    if (locked) {
      onSave({ ...toDraft(invoice), currency: value });
    }
  }

  function patchLine(lineId: string, next: Partial<InvoiceLine>) {
    if (!editable) return;
    patch({
      lines: draft.lines.map((line) => (line.id === lineId ? { ...line, ...next } : line)),
    });
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 shrink-0 bg-white/95 backdrop-blur-sm">
        <header className="border-b border-[#edf2f8] px-3.5 py-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <StatusBadge
                size="xs"
                tone={invoiceListStatusTone[listStatus === "all" ? "draft" : listStatus]}
              >
                {t(`listStatus.${listStatus}`)}
              </StatusBadge>
              <h3 className="mt-1.5 truncate text-[15px] font-semibold text-[#063586]">
                {t("panel.title", { number: invoiceDisplayNumber(invoice) })}
              </h3>
              <p className="mt-0.5 truncate text-sm font-medium text-[#24334c]">
                {working.customerName}
              </p>
              <p className="truncate text-[11px] text-[#7d8aa0]">
                {working.reference || invoice.quoteId}
              </p>
            </div>
            <div className="relative flex shrink-0 items-center gap-1" ref={moreRef}>
              {hasMoreActions ? (
                <button
                  aria-expanded={moreOpen}
                  aria-haspopup="menu"
                  aria-label={t("menu.trigger")}
                  className="action-motion soft-button grid h-8 w-8 place-items-center rounded-[8px] text-[#66758d]"
                  onClick={() => setMoreOpen((value) => !value)}
                  type="button"
                >
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
              <button
                aria-label={t("close")}
                className="action-motion soft-button grid h-8 w-8 place-items-center rounded-[8px] text-[#66758d]"
                onClick={onClose}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
              {moreOpen && hasMoreActions ? (
                <div
                  className="absolute top-[calc(100%+4px)] right-0 z-20 w-44 rounded-[10px] border border-white/80 bg-white/95 p-1 shadow-[6px_10px_24px_rgba(78,108,145,0.12)]"
                  role="menu"
                >
                  {locked ? (
                    <button
                      className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold text-[#405069] hover:bg-[#f5f8fd]"
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        onSend();
                      }}
                    >
                      <Mail aria-hidden="true" className="h-3.5 w-3.5 text-[#044ce2]" />
                      {t("menu.send")}
                    </button>
                  ) : canUpdate ? (
                    <button
                      className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold text-[#c9564f] hover:bg-[#f5f8fd]"
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        onDelete();
                      }}
                    >
                      {t("menu.delete")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <AnimatedSelectionGroup
          className="min-w-0 border-b border-[#edf2f8] px-1.5"
          id="invoice-detail-tabs"
        >
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
                      layoutId={`${TOP_TABS_ACTIVE_LAYOUT_ID}-invoice-details`}
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
                  {t("sections.customer")}
                </p>
                {editable ? (
                  <span className="sr-only">{t("changeCustomer")}</span>
                ) : null}
              </div>
              {editable ? (
                <SoftSelect
                  hideLabel
                  label={t("changeCustomer")}
                  options={customers.map((customer) => ({
                    value: customer.id,
                    label: customer.name,
                  }))}
                  value={draft.customerId}
                  onChange={(value) => {
                    const customer = customers.find((item) => item.id === value);
                    patch({ customerId: value, customerName: customer?.name ?? draft.customerName });
                  }}
                />
              ) : (
                <p className="mt-1 text-sm font-semibold text-[#24334c]">{invoice.customerName}</p>
              )}
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
                {t("sections.information")}
              </p>
              <Field
                label={t("number")}
                readOnly
                value={
                  invoice.number
                    ? invoice.number
                    : t("draftNumber", { id: invoice.temporaryNumber })
                }
              />
              {canOpenQuote ? (
                <label className="block">
                  <span className="text-[11px] font-medium text-[#7d8aa0]">{t("relatedQuote")}</span>
                  <Link
                    className="soft-input mt-1 flex min-h-10 items-center px-3 text-sm font-semibold text-[#044ce2]"
                    href={`/devis?quote=${invoice.quoteId}`}
                  >
                    {invoice.quoteId}
                  </Link>
                </label>
              ) : (
                <Field label={t("relatedQuote")} readOnly value={invoice.quoteId} />
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Field
                  disabled={!editable}
                  label={t("issueDate")}
                  onChange={(value) => patch({ issueDate: value })}
                  type="date"
                  value={working.issueDate}
                />
                <Field
                  disabled={!editable}
                  label={t("dueDate")}
                  onChange={(value) => patch({ dueDate: value })}
                  type="date"
                  value={working.dueDate}
                />
              </div>
              {editable ? (
                <SoftSelect
                  label={t("paymentTerms")}
                  menuZIndexClassName="z-[110]"
                  options={PAYMENT_TERMS.map((term) => ({
                    value: term,
                    label: t(`terms.${term}`),
                  }))}
                  value={draft.paymentTerms}
                  onChange={(value) => patch({ paymentTerms: value as PaymentTerms })}
                />
              ) : (
                <Field label={t("paymentTerms")} readOnly value={t(`terms.${invoice.paymentTerms}`)} />
              )}
              <Field
                disabled={!editable}
                label={t("poNumber")}
                onChange={(value) => patch({ poNumber: value })}
                value={working.poNumber ?? ""}
              />
              <Field
                disabled={!editable}
                label={t("reference")}
                onChange={(value) => patch({ reference: value })}
                value={working.reference ?? ""}
              />
              {canUpdate ? (
                <SoftSelect
                  label={t("currency")}
                  menuZIndexClassName="z-[110]"
                  options={CURRENCY_OPTIONS.map((code) => ({
                    value: code,
                    label: code,
                  }))}
                  value={draft.currency || invoice.currency || "EUR"}
                  onChange={patchCurrency}
                />
              ) : (
                <Field label={t("currency")} readOnly value={invoice.currency || "EUR"} />
              )}
            </section>

            <Amounts totals={totals} vatGroups={vatGroups} vatLabel={t} />
          </div>
        ) : null}

        {tab === "items" ? (
          <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            <div className="overflow-hidden rounded-[10px] border border-[#e7edf5]">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] text-[#8b97a8]">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("description")}</th>
                    <th className="px-2 py-2 font-medium">{t("qty")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("unit")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("lineTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {working.lines.map((line) => (
                    <tr className="border-t border-[#edf1f6]" key={line.id}>
                      <td className="px-3 py-2">
                        <input
                          className="h-9 w-full rounded-[8px] border border-[#dfe6f1] px-2 text-sm"
                          disabled={!editable}
                          onChange={(event) => patchLine(line.id, { label: event.target.value })}
                          value={line.label}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <AmountInput
                          className="h-9 w-16 rounded-[8px] border border-[#dfe6f1] px-2 text-[#24334c]"
                          disabled={!editable}
                          mode="integer"
                          value={String(line.qty)}
                          onValueChange={(raw) => {
                            const digits = sanitizeIntegerInput(raw);
                            patchLine(line.id, { qty: Math.max(1, Number(digits) || 1) });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <AmountInput
                          className="h-9 w-24 rounded-[8px] border border-[#dfe6f1] px-2 text-right text-[#24334c]"
                          disabled={!editable}
                          value={
                            priceDrafts[line.id] ??
                            (line.unitHtCents === 0
                              ? ""
                              : String(line.unitHtCents / 100).replace(".", ","))
                          }
                          onValueChange={(raw) => {
                            setPriceDrafts((current) => ({ ...current, [line.id]: raw }));
                            patchLine(line.id, {
                              unitHtCents: Math.round(parseAmount(raw) * 100) || 0,
                            });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-[#102342]">
                        {formatMoneyFromCents(line.qty * line.unitHtCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Amounts totals={totals} vatGroups={vatGroups} vatLabel={t} />
          </div>
        ) : null}

        {tab === "payments" ? (
          <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            {paymentStatus === "paid" ? (
              <div className="rounded-[10px] bg-[#e8f7f0] px-3 py-3">
                <p className="text-sm font-semibold text-[#238567]">{t("payments.paidTitle")}</p>
                <p className="mt-0.5 text-[11px] text-[#3d7a62]">
                  {t("payments.paidOn", {
                    date: payments[0]
                      ? new Intl.DateTimeFormat(locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(`${payments[0].date}T00:00:00`))
                      : "—",
                  })}
                </p>
              </div>
            ) : paymentStatus === "partial" ? (
              <div className="rounded-[10px] bg-[#fff4e6] px-3 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-[#7d8aa0]">{t("payments.paid")}</span>
                  <strong className="tabular-nums">{formatMoneyFromCents(paid)}</strong>
                </div>
                <div className="mt-1 flex justify-between gap-2">
                  <span className="text-[#7d8aa0]">{t("payments.remaining")}</span>
                  <strong className="tabular-nums">{formatMoneyFromCents(remaining)}</strong>
                </div>
              </div>
            ) : null}

            {payments.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#7d8aa0]">{t("payments.empty")}</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] text-[#8b97a8]">
                  <tr>
                    <th className="py-2 font-medium">{t("payments.date")}</th>
                    <th className="py-2 font-medium">{t("payments.reference")}</th>
                    <th className="py-2 text-right font-medium">{t("payments.amount")}</th>
                    <th className="py-2 font-medium">{t("payments.method")}</th>
                    <th className="py-2 font-medium">{t("payments.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr className="border-t border-[#edf2f8]" key={payment.id}>
                      <td className="py-2 text-xs tabular-nums text-[#405069]">
                        {new Intl.DateTimeFormat(locale).format(
                          new Date(`${payment.date}T00:00:00`),
                        )}
                      </td>
                      <td className="py-2 text-xs font-semibold text-[#24334c]">
                        {payment.reference}
                      </td>
                      <td className="py-2 text-right text-xs tabular-nums">
                        {formatMoneyFromCents(payment.amountCents)}
                      </td>
                      <td className="py-2 text-xs text-[#516078]">
                        {t(`payments.methods.${payment.method}`)}
                      </td>
                      <td className="py-2">
                        <StatusBadge size="xs" tone={payment.status === "completed" ? "green" : "orange"}>
                          {t(`payments.states.${payment.status}`)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {tab === "activity" ? (
          <ol
            className="flex flex-col gap-3 py-1"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            {invoice.activity.map((item, index) => {
              const isLatest = index === invoice.activity.length - 1;
              const isLast = index === invoice.activity.length - 1;
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
                      "min-w-0 rounded-[12px] border border-transparent bg-white px-2 py-2 transition-colors",
                      isLatest
                        ? "invoice-activity-card--live border-[#c6ebd9] shadow-[0_4px_14px_rgb(34_133_103/0.1)]"
                        : "hover:bg-[#f4faf7]",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <IconTile icon={ReceiptText} size="sm" tone="green" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "text-xs font-semibold",
                                isLatest ? "text-[#1b6b52]" : "text-[#24334c]",
                              )}
                            >
                              {t(`activity.${item.kind}`, {
                                quote: item.quoteId ?? invoice.quoteId,
                              })}
                            </p>
                            {isLatest ? (
                              <p className="mt-0.5 text-[10px] font-semibold tracking-[0.02em] text-[#2da77b] uppercase">
                                {t("activity.latest")}
                              </p>
                            ) : null}
                          </div>
                          <StatusBadge size="xs" tone={isLatest ? "green" : "slate"}>
                            {item.actorName}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>
                  </article>
                </ActivityFeedItem>
              );
            })}
          </ol>
        ) : null}
      </div>

      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[#e8eef6] bg-[rgb(250_253_255/0.96)] px-3.5 py-3">
        {locked ? (
          canSend ? (
            <button
              className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
              onClick={onSend}
              type="button"
            >
              {t("sendEmail")}
            </button>
          ) : null
        ) : (
          <>
            {editable ? (
              <button
                className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
                onClick={() => {
                  setDraft(toDraft(invoice));
                  onCancel();
                }}
                type="button"
              >
                {t("cancel")}
              </button>
            ) : null}
            {editable ? (
              <button
                className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069] disabled:opacity-40"
                disabled={!dirty}
                onClick={() => onSave(draft)}
                type="button"
              >
                {t("saveDraft")}
              </button>
            ) : null}
            {canValidate ? (
              <button
                className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
                onClick={onValidate}
                type="button"
              >
                {t("validate")}
              </button>
            ) : null}
          </>
        )}
        <button
          className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
          onClick={onClose}
          type="button"
        >
          {t("close")}
        </button>
      </footer>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  if (type === "date" && onChange && !readOnly) {
    return (
      <SoftDatePicker
        disabled={disabled}
        label={label}
        triggerClassName="!h-10 rounded-[10px] px-3 text-sm"
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-medium text-[#7d8aa0]">{label}</span>
      <input
        className="soft-input mt-1 min-h-10 w-full rounded-[10px] px-3 text-sm text-[#24334c] outline-none disabled:opacity-70"
        disabled={disabled}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly}
        type={type}
        value={value}
      />
    </label>
  );
}

function Amounts({
  totals,
  vatGroups,
  vatLabel,
}: {
  totals: ReturnType<typeof invoiceTotals>;
  vatGroups: ReturnType<typeof invoiceVatBreakdown>;
  vatLabel: ReturnType<typeof useTranslations>;
}) {
  return (
    <section className="space-y-2 rounded-[10px] bg-[#f7faff] px-3 py-3">
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-[#7d8aa0]">{vatLabel("ht")}</span>
        <strong className="tabular-nums">{formatMoneyFromCents(totals.htCents)}</strong>
      </div>
      {vatGroups.map((group) => (
        <div className="flex justify-between gap-3 text-sm" key={group.rate}>
          <span className="text-[#7d8aa0]">{vatLabel("vat", { rate: group.rate })}</span>
          <strong className="tabular-nums">{formatMoneyFromCents(group.vatCents)}</strong>
        </div>
      ))}
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-semibold text-[#063586]">{vatLabel("ttc")}</span>
        <strong className="text-base font-bold tabular-nums text-[#063586]">
          {formatMoneyFromCents(totals.ttcCents)}
        </strong>
      </div>
    </section>
  );
}
