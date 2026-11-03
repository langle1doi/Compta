"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { FormSheet } from "@/components/forms/form-sheet";
import {
  invoiceDisplayNumber,
  invoiceTotals,
  paidCentsFor,
  remainingCentsFor,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { ledgerToday } from "@/features/quotes/model";
import { formatMoneyFromCents } from "@/lib/money";

import {
  daysOverdue,
  reminderRecipient,
  remindersForInvoice,
  sendReminder,
  type ReminderEvent,
} from "../reminders";

export function CollectionFollowUpSheet({
  open,
  invoice,
  payments,
  reminderEvents,
  onClose,
  onSent,
}: {
  open: boolean;
  invoice: InvoiceRecord | null;
  payments: InvoicePayment[];
  reminderEvents: ReminderEvent[];
  onClose: () => void;
  onSent: () => void;
}) {
  const t = useTranslations("payments.followUp");
  const closeT = useTranslations("payments");
  const locale = useLocale();
  const [composerOpen, setComposerOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const history = useMemo(
    () => (invoice ? remindersForInvoice(reminderEvents, invoice.id) : []),
    [invoice, reminderEvents],
  );

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [locale],
  );
  const dateTimeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [locale],
  );

  if (!invoice) {
    return (
      <FormSheet
        closeLabel={closeT("close")}
        open={open}
        title={t("title")}
        widthClassName="sm:max-w-[520px]"
        zIndexClassName="z-[70]"
        onClose={onClose}
      >
        <p className="text-sm text-[#7d8aa0]">{t("missing")}</p>
      </FormSheet>
    );
  }

  const activeInvoice = invoice;
  const total = invoiceTotals(activeInvoice).ttcCents;
  const paid = paidCentsFor(activeInvoice.id, payments);
  const remaining = remainingCentsFor(activeInvoice, payments);
  const overdueDays = daysOverdue(activeInvoice.dueDate, ledgerToday);
  const recipient = reminderRecipient(activeInvoice.customerId);
  const invoiceNo = invoiceDisplayNumber(activeInvoice);
  const subject = t("subject", { invoice: invoiceNo });
  const message = t("message", {
    invoice: invoiceNo,
    amount: formatMoneyFromCents(remaining),
    due: dateFmt.format(new Date(`${activeInvoice.dueDate}T00:00:00`)),
  });

  function handleClose() {
    setComposerOpen(false);
    onClose();
  }

  function confirmSend() {
    if (sending || remaining <= 0) return;
    const invoiceId = activeInvoice.id;
    setSending(true);
    window.setTimeout(() => {
      sendReminder({
        invoiceId,
        recipient,
        subject,
        stage: "MANUAL",
      });
      setSending(false);
      setComposerOpen(false);
      onSent();
    }, 220);
  }

  return (
    <FormSheet
      closeLabel={closeT("close")}
      description={`${invoiceNo} · ${invoice.customerName}`}
      footer={
        composerOpen ? (
          <div className="flex justify-end gap-2">
            <button
              className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
              type="button"
              onClick={() => setComposerOpen(false)}
            >
              {t("cancel")}
            </button>
            <button
              aria-busy={sending}
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-40"
              disabled={sending}
              type="button"
              onClick={confirmSend}
            >
              {sending ? t("sending") : t("confirmSend")}
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button
              className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
              type="button"
              onClick={handleClose}
            >
              {closeT("close")}
            </button>
            <button
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-40"
              disabled={remaining <= 0}
              type="button"
              onClick={() => setComposerOpen(true)}
            >
              {t("sendNow")}
            </button>
          </div>
        )
      }
      open={open}
      title={t("title")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[70]"
      onClose={handleClose}
    >
      <div className="space-y-4">
        <section className="rounded-[12px] border border-[#e8eef6] bg-[#f8fbff] p-3">
          <p className="text-[11px] font-semibold text-[#7d8aa0]">{t("outstanding")}</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums tracking-[-0.03em] text-[#102342]">
            {formatMoneyFromCents(remaining)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            <Summary label={t("invoiceTotal")} value={formatMoneyFromCents(total)} />
            <Summary label={t("alreadyPaid")} value={formatMoneyFromCents(paid)} />
            <Summary
              label={t("dueDate")}
              value={dateFmt.format(new Date(`${activeInvoice.dueDate}T00:00:00`))}
            />
            <Summary
              label={t("overdue")}
              value={
                overdueDays > 0
                  ? t("overdueDays", { count: overdueDays })
                  : t("notOverdue")
              }
            />
          </dl>
        </section>

        <section>
          <h4 className="text-[12px] font-semibold text-[#24334c]">{t("history")}</h4>
          {history.length === 0 ? (
            <p className="mt-2 text-xs text-[#7d8aa0]">{t("historyEmpty")}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {history.map((item) => (
                <li
                  className="rounded-[10px] border border-[#edf2f8] px-3 py-2"
                  key={item.id}
                >
                  <p className="text-xs font-semibold text-[#24334c]">
                    {t(`stages.${item.stage}`)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#7d8aa0]">
                    {dateTimeFmt.format(new Date(item.sentAt))} · {t(`channels.${item.channel}`)} ·{" "}
                    {item.actor}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#7d8aa0]">{item.recipient}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {composerOpen ? (
          <section className="space-y-2.5 rounded-[12px] border border-[#e1e7f1] p-3">
            <h4 className="text-[12px] font-semibold text-[#24334c]">{t("composer")}</h4>
            <Row label={t("to")} value={recipient} />
            <Row label={t("subjectLabel")} value={subject} />
            <div>
              <p className="text-[11px] font-semibold text-[#7d8aa0]">{t("preview")}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#405069]">
                {message}
              </p>
            </div>
            <p className="text-[11px] text-[#98a4b5]">{t("toneHint")}</p>
          </section>
        ) : (
          <section>
            <h4 className="text-[12px] font-semibold text-[#24334c]">{t("next")}</h4>
            <p className="mt-1 text-xs leading-5 text-[#7d8aa0]">{t("nextHint")}</p>
          </section>
        )}
      </div>
    </FormSheet>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium text-[#7d8aa0]">{label}</dt>
      <dd className="mt-0.5 truncate text-xs font-semibold tabular-nums text-[#24334c]">
        {value}
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#7d8aa0]">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-[#24334c]">{value}</p>
    </div>
  );
}
