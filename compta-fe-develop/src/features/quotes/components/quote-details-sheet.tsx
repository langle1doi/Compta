"use client";

import { useLocale, useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import { FormSheet } from "@/components/forms/form-sheet";
import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { allowedQuoteAction, type QuoteCaps } from "./quote-row-menu";

import {
  nextActionFor,
  quoteTotals,
  type CustomerRecord,
  type QuoteRecord,
} from "../model";
import { customerName, ownerById } from "../query";
import { quoteStatusTone } from "../status";

export function QuoteDetailsSheet({
  open,
  quote,
  customers,
  caps,
  onClose,
  onNextAction,
}: {
  open: boolean;
  quote: QuoteRecord | null;
  customers: CustomerRecord[];
  caps: QuoteCaps;
  onClose: () => void;
  onNextAction: (id: string) => void;
}) {
  const t = useTranslations("register");
  const statusT = useTranslations("status");
  const workT = useTranslations();
  const locale = useLocale();

  if (!quote) {
    return (
      <FormSheet
        closeLabel={t("cancel")}
        description={t("sheet.body")}
        open={open}
        title={t("sheet.title")}
        widthClassName="sm:max-w-[520px]"
        zIndexClassName="z-[70]"
        onClose={onClose}
      >
        <p className="text-sm text-[#7d8aa0]">{t("editor.missing")}</p>
      </FormSheet>
    );
  }

  const totals = quoteTotals(quote);
  const owner = ownerById(quote.ownerId);
  const action = allowedQuoteAction(nextActionFor(quote).kind, caps);
  const name = customerName(customers, quote.customerId);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const validLabel = dateFmt.format(new Date(`${quote.validUntil}T00:00:00`));

  return (
    <FormSheet
      closeLabel={t("cancel")}
      description={t("sheet.body")}
      open={open}
      title={t("sheet.title")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[70]"
      onClose={onClose}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <button
            className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
            onClick={onClose}
            type="button"
          >
            {t("cancel")}
          </button>
          {action !== null ? (
            <button
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
              onClick={() => onNextAction(quote.id)}
              type="button"
            >
              {t(`actions.${action}`)}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <section className="space-y-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#044ce2] tabular-nums">{quote.id}</p>
            <StatusBadge size="sm" tone={quoteStatusTone[quote.status]}>
              {statusT(quote.status)}
            </StatusBadge>
          </div>
          <Field label={t("customer")} value={name} />
          <Field label={t("sheet.work")} value={workT(quote.workKey)} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t("owner")} value={owner?.name ?? "—"} />
            <Field label={t("validity")} value={validLabel} />
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
            {t("editor.lines")}
          </p>
          {quote.lines.length === 0 ? (
            <p className="text-xs text-[#7d8aa0]">{t("editor.emptyLines")}</p>
          ) : (
            <ul className="overflow-hidden rounded-[10px] border border-[#e7edf5]">
              {quote.lines.map((line) => (
                <li
                  className="flex items-start justify-between gap-3 border-t border-[#edf2f8] px-3 py-2.5 first:border-t-0"
                  key={line.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#24334c]">
                      {line.label || "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#7d8aa0] tabular-nums">
                      {t("sheet.lineQty", { qty: line.qty })}
                    </p>
                  </div>
                  <strong className="shrink-0 text-sm font-semibold text-[#102342] tabular-nums">
                    {formatMoneyFromCents(line.qty * line.unitHtCents)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2 rounded-[10px] bg-[#f7faff] px-3 py-3">
          <Row label={t("preview.ht")} value={formatMoneyFromCents(totals.htCents)} />
          <Row
            label={t("preview.vat", { rate: quote.vatRate })}
            value={formatMoneyFromCents(totals.vatCents)}
          />
          <Row
            emphasize
            label={t("preview.ttc")}
            value={formatMoneyFromCents(totals.ttcCents)}
          />
        </section>

        {quote.activity.length > 0 ? (
          <section className="space-y-2">
            <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
              {t("preview.activity")}
            </p>
            <ul className="space-y-2">
              {quote.activity.slice(0, 4).map((item) => (
                <li
                  className="rounded-[10px] border border-[#edf2f8] px-3 py-2 text-xs text-[#516078]"
                  key={item.id}
                >
                  <span className="mr-2 font-medium text-[#98a4b5] tabular-nums">
                    {dateFmt.format(new Date(`${item.at}T00:00:00`))}
                  </span>
                              <ActivityLine item={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </FormSheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[#7d8aa0]">{label}</span>
      <input
        className="soft-input mt-1 min-h-10 w-full rounded-[10px] px-3 text-sm text-[#24334c] outline-none"
        readOnly
        value={value}
      />
    </label>
  );
}

function Row({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={emphasize ? "font-semibold text-[#063586]" : "text-[#7d8aa0]"}>
        {label}
      </span>
      <strong
        className={cn(
          "tabular-nums",
          emphasize ? "text-base font-bold text-[#063586]" : "font-medium text-[#24334c]",
        )}
      >
        {value}
      </strong>
    </div>
  );
}

function ActivityLine({ item }: { item: QuoteRecord["activity"][number] }) {
  const messages = useTranslations();
  return <>{messages(item.messageKey, item.values)}</>;
}
