"use client";

import { DocumentStatus } from "@/components/status/document-status";
import { formatMoneyFromCents } from "@/lib/money";
import { customerName, ownerById } from "@/features/quotes/query";
import { nextActionFor, quoteTotals, type CustomerRecord, type QuoteRecord } from "@/features/quotes/model";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function QuotePreview({
  quote,
  customers,
  width,
  onWidth,
  onClose,
  onAction,
}: {
  quote: QuoteRecord;
  customers: CustomerRecord[];
  width: number;
  onWidth: (width: number) => void;
  onClose: () => void;
  onAction: (quote: QuoteRecord) => void;
}) {
  const t = useTranslations("register");
  const messages = useTranslations();
  const totals = quoteTotals(quote);
  const owner = ownerById(quote.ownerId);
  const action = nextActionFor(quote);

  return (
    <aside
      className="relative flex h-full w-full min-h-0 shrink-0 flex-col border-l border-[#e1e7f1] bg-white xl:w-[var(--preview-width)]"
      style={{ "--preview-width": `${width}px` } as CSSProperties}
    >
      <button
        className="absolute top-0 left-0 hidden h-full w-1.5 cursor-col-resize xl:block"
        type="button"
        aria-label={t("preview.resize")}
        onPointerDown={(event) => {
          const startX = event.clientX;
          const startWidth = width;
          const move = (pointer: PointerEvent) => {
            onWidth(Math.min(440, Math.max(380, startWidth + startX - pointer.clientX)));
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      />
      <div className="flex items-start justify-between gap-3 border-b border-[#edf1f6] px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#044ce2]">{quote.id}</p>
          <h2 className="mt-1 truncate text-base font-semibold text-[#24334c]">
            {customerName(customers, quote.customerId)}
          </h2>
        </div>
        <button className="text-xs font-semibold text-[#728097]" type="button" onClick={onClose}>
          {t("cancel")}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <DocumentStatus status={quote.status} />
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[#728097]">{t("preview.ht")}</dt>
            <dd className="tabular-nums text-[#24334c]">{formatMoneyFromCents(totals.htCents)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[#728097]">{t("preview.vat", { rate: quote.vatRate })}</dt>
            <dd className="tabular-nums text-[#24334c]">{formatMoneyFromCents(totals.vatCents)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-[#edf1f6] pt-3">
            <dt className="font-medium text-[#063586]">{t("preview.ttc")}</dt>
            <dd className="text-lg font-semibold tabular-nums tracking-[-0.03em] text-[#063586]">
              {formatMoneyFromCents(totals.ttcCents)}
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-[#405069]">
          {t("preview.valid", { date: formatDate(quote.validUntil) })}
        </p>
        <p className="mt-2 text-sm text-[#405069]">
          {t("preview.owner")} · {owner?.name}
        </p>
        <h3 className="mt-6 text-xs font-semibold text-[#8b97a8]">{t("preview.activity")}</h3>
        <ul className="mt-2 space-y-2">
          {quote.activity.slice(0, 3).map((item) => (
            <li key={item.id} className="text-sm text-[#405069]">
              <span className="mr-2 text-xs text-[#8b97a8]">{formatDate(item.at)}</span>
              {messages(item.messageKey, item.values)}
            </li>
          ))}
        </ul>
      </div>
      {action.kind !== "none" ? (
        <div className="border-t border-[#edf1f6] p-4">
          <button
            className="min-h-10 w-full rounded-[10px] bg-[#044ce2] text-sm font-semibold text-white hover:bg-[#063586]"
            type="button"
            onClick={() => onAction(quote)}
          >
            {t(`actions.${action.kind}`)}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
