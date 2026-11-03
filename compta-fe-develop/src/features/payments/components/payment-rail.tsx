"use client";

import { useNestedScrollChain } from "@/lib/use-nested-scroll-chain";

import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, type RefObject } from "react";

import { CardHeader } from "@/components/dashboard/overview/dashboard-card";
import {
  invoiceDisplayNumber,
  remainingCentsFor,
  type BankTransaction,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { formatMoneyFromCents } from "@/lib/money";

import {
  deriveQueueStatus,
  pendingBankTransactions,
  previewBankTransactions,
} from "../reconciliation";

export function PaymentRail({
  invoices,
  payments,
  queue,
  canReconcile,
  onMatch,
  onReview,
  onViewAll,
  viewAllRef,
}: {
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  queue: BankTransaction[];
  canReconcile: boolean;
  onMatch: (id: string) => void;
  onReview: (id: string) => void;
  onViewAll: () => void;
  viewAllRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3">
      <div className="min-h-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
        <ReconciliationQueue
          canReconcile={canReconcile}
          invoices={invoices}
          payments={payments}
          queue={queue}
          viewAllRef={viewAllRef}
          onMatch={onMatch}
          onReview={onReview}
          onViewAll={onViewAll}
        />
      </div>
    </aside>
  );
}

function ReconciliationQueue({
  queue,
  invoices,
  payments,
  canReconcile,
  onMatch,
  onReview,
  onViewAll,
  viewAllRef,
}: {
  queue: BankTransaction[];
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  canReconcile: boolean;
  onMatch: (id: string) => void;
  onReview: (id: string) => void;
  onViewAll: () => void;
  viewAllRef?: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("payments.queue");
  const listScrollRef = useRef<HTMLUListElement>(null);
  useNestedScrollChain(listScrollRef);
  const locale = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const invoicesById = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );
  const pending = useMemo(() => pendingBankTransactions(queue), [queue]);
  const preview = useMemo(
    () => previewBankTransactions(queue, invoicesById, payments),
    [invoicesById, payments, queue],
  );
  const localViewAllRef = useRef<HTMLButtonElement>(null);
  const triggerRef = viewAllRef ?? localViewAllRef;

  return (
    <section
      aria-labelledby="payment-queue-title"
      className="dashboard-card dashboard-list flex min-h-0 flex-1 flex-col overflow-hidden lg:col-span-2 xl:col-span-1"
    >
      <div className="dashboard-list__header">
        <CardHeader title={t("title")} titleId="payment-queue-title">
          <button
            ref={triggerRef}
            aria-label={t("viewAllAria")}
            className="dashboard-link inline-flex items-center gap-0.5 text-[11px]"
            type="button"
            onClick={onViewAll}
          >
            {t("viewAll")}
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
          </button>
        </CardHeader>
      </div>
      {pending.length === 0 ? (
        <div className="px-3.5 py-3">
          <p className="text-xs font-semibold text-[#238567]">{t("emptyTitle")}</p>
          <p className="mt-0.5 text-[11px] leading-5 text-[#7d8aa0]">{t("emptyBody")}</p>
        </div>
      ) : (
        <ul ref={listScrollRef} className="dashboard-scroll--chain dashboard-scroll min-h-0 max-h-[240px] flex-1 overflow-y-auto overscroll-contain border-t border-[rgb(217_227_238/0.72)] xl:max-h-none">
          {preview.map((item) => {
            const suggested = item.suggestedInvoiceId
              ? invoicesById.get(item.suggestedInvoiceId)
              : undefined;
            const status = deriveQueueStatus(item, suggested, payments);
            const needsReview = status === "needs_review" || status === "unmatched";
            const canAct = status !== "cannot_match";
            return (
              <li
                className="dashboard-list__row flex flex-col items-stretch gap-1.5 py-2.5"
                key={item.id}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="dashboard-list__amount">
                      {formatMoneyFromCents(item.amountCents)}
                    </p>
                    <p className="dashboard-list__secondary">
                      {dateFmt.format(new Date(`${item.date}T00:00:00`))}
                    </p>
                    <p className="dashboard-list__secondary truncate" title={item.label}>
                      {item.label}
                    </p>
                    {suggested ? (
                      <p className="mt-0.5 text-[11px] text-[#516078]">
                        {t("possible", {
                          invoice: invoiceDisplayNumber(suggested),
                          remaining: formatMoneyFromCents(
                            remainingCentsFor(suggested, payments),
                          ),
                        })}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-[#516078]">{t("noSuggestion")}</p>
                    )}
                  </div>
                  {canReconcile && canAct ? (
                    <button
                      className="action-motion soft-button h-7 shrink-0 rounded-[8px] px-2 text-[11px] font-semibold text-[#044ce2]"
                      onClick={() => (needsReview ? onReview(item.id) : onMatch(item.id))}
                      type="button"
                    >
                      {needsReview ? t("review") : t("match")}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
