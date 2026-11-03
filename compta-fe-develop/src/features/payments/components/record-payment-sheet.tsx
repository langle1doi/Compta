"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { AmountInput } from "@/components/compte/amount-input";
import { SoftDatePicker } from "@/components/compte/soft-date-picker";
import { SoftSelect } from "@/components/compte/soft-select";
import { FormSheet } from "@/components/forms/form-sheet";
import {
  invoiceDisplayNumber,
  invoiceTotals,
  paidCentsFor,
  remainingCentsFor,
  type InvoicePaymentMethod,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { ledgerToday } from "@/features/quotes/model";
import { formatMoneyFromCents, parseAmount } from "@/lib/money";

import { PAYMENT_METHOD_ORDER } from "../model";

function formatAmountInput(cents: number) {
  const absolute = Math.abs(Math.round(cents));
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped},${fraction}`;
}

export function RecordPaymentSheet({
  open,
  invoices,
  payments,
  prefillInvoiceId,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  prefillInvoiceId?: string | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: {
    invoiceId: string;
    amountCents: number;
    date: string;
    method: InvoicePaymentMethod;
    reference: string;
    bankReference: string;
    notes: string;
  }) => void;
}) {
  const t = useTranslations("payments.record");
  const methodsT = useTranslations("payments");
  const initialInvoiceId =
    (prefillInvoiceId && invoices.some((item) => item.id === prefillInvoiceId)
      ? prefillInvoiceId
      : invoices[0]?.id) ?? "";
  const initialInvoice = invoices.find((item) => item.id === initialInvoiceId);
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);
  const [amount, setAmount] = useState(
    initialInvoice ? formatAmountInput(remainingCentsFor(initialInvoice, payments)) : "",
  );
  const [date, setDate] = useState(ledgerToday);
  const [method, setMethod] = useState<InvoicePaymentMethod>("transfer");
  const [reference, setReference] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const invoice = invoices.find((item) => item.id === invoiceId);
  const remaining = invoice ? remainingCentsFor(invoice, payments) : 0;
  const alreadyPaid = invoice ? paidCentsFor(invoice.id, payments) : 0;
  const invoiceTotal = invoice ? invoiceTotals(invoice).ttcCents : 0;

  const options = useMemo(
    () =>
      invoices.map((item) => ({
        value: item.id,
        label: `${invoiceDisplayNumber(item)} · ${item.customerName} · ${formatMoneyFromCents(remainingCentsFor(item, payments))}`,
      })),
    [invoices, payments],
  );

  function resetAndClose() {
    setLocalError(null);
    onClose();
  }

  function submit() {
    if (!invoice) {
      setLocalError(t("noInvoices"));
      return;
    }
    const euros = parseAmount(amount);
    const amountCents = Math.round(euros * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setLocalError(t("invalidAmount"));
      return;
    }
    if (amountCents > remaining) {
      setLocalError(t("overpayment"));
      return;
    }
    setLocalError(null);
    onSave({
      invoiceId: invoice.id,
      amountCents,
      date,
      method,
      reference: reference.trim(),
      bankReference: bankReference.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <FormSheet
      closeLabel={methodsT("close")}
      footer={
        invoices.length === 0 ? null : (
          <div className="flex justify-end gap-2">
            <button
              className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
              onClick={resetAndClose}
              type="button"
            >
              {t("cancel")}
            </button>
            <button
              aria-busy={saving}
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-40"
              disabled={saving}
              onClick={submit}
              type="button"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        )
      }
      open={open}
      title={t("title")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[60]"
      onClose={resetAndClose}
    >
      {invoices.length === 0 ? (
        <div className="px-1 py-6 text-center">
          <p className="text-sm font-semibold text-[#24334c]">{t("noInvoicesTitle")}</p>
          <p className="mt-1 text-xs leading-5 text-[#7d8aa0]">{t("noInvoices")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <SoftSelect
            label={`${t("invoice")} *`}
            options={options}
            value={invoiceId}
            onChange={(value) => {
              setInvoiceId(value);
              setLocalError(null);
              const next = invoices.find((item) => item.id === value);
              setAmount(next ? formatAmountInput(remainingCentsFor(next, payments)) : "");
            }}
          />
          {invoice ? (
            <dl className="grid grid-cols-3 gap-2 rounded-[9px] border border-[#edf2f8] px-3 py-2.5 text-[11px]">
              <div>
                <dt className="text-[#7d8aa0]">{t("invoiceTotal")}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-[#24334c]">
                  {formatMoneyFromCents(invoiceTotal)}
                </dd>
              </div>
              <div>
                <dt className="text-[#7d8aa0]">{t("alreadyPaid")}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-[#24334c]">
                  {formatMoneyFromCents(alreadyPaid)}
                </dd>
              </div>
              <div>
                <dt className="text-[#7d8aa0]">{t("remainingLabel")}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-[#24334c]">
                  {formatMoneyFromCents(remaining)}
                </dd>
              </div>
            </dl>
          ) : null}
          <label className="block">
            <span className="text-[11px] font-semibold text-[#66758d]">{t("amount")} *</span>
            <AmountInput
              className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c]"
              placeholder="0,00"
              value={amount}
              onValueChange={setAmount}
            />
          </label>
          <SoftDatePicker
            label={t("date")}
            required
            triggerClassName="!h-10 rounded-[9px] px-3 text-sm"
            value={date}
            onChange={setDate}
          />
          <SoftSelect
            label={`${t("method")} *`}
            options={PAYMENT_METHOD_ORDER.filter((item) => item !== "check").map((item) => ({
              value: item,
              label: methodsT(`methods.${item}`),
            }))}
            value={method}
            onChange={(value) => setMethod(value as InvoicePaymentMethod)}
          />
          <label className="block">
            <span className="text-[11px] font-semibold text-[#66758d]">{t("reference")}</span>
            <input
              className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c]"
              onChange={(event) => setReference(event.target.value)}
              value={reference}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-[#66758d]">{t("bankReference")}</span>
            <input
              className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c]"
              onChange={(event) => setBankReference(event.target.value)}
              value={bankReference}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-[#66758d]">{t("notes")}</span>
            <textarea
              className="soft-input mt-1 min-h-[72px] w-full rounded-[9px] px-3 py-2 text-sm text-[#24334c]"
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>
          {localError || error ? (
            <p className="text-xs font-medium text-[#c9564f]">{localError ?? error}</p>
          ) : null}
        </div>
      )}
    </FormSheet>
  );
}
