"use client";

import { useLocale, useTranslations } from "next-intl";

import { DashboardScroll } from "@/components/dashboard/dashboard-scroll";
import { StatusBadge } from "@/components/dashboard/tone";
import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { nextActionFor, quoteTotals, type QuoteRecord } from "../model";
import { customerName, ownerById } from "../query";
import { quoteStatusTone } from "../status";
import {
  allowedQuoteAction,
  hasQuoteNextActions,
  QuoteRowMenu,
  type QuoteCaps,
  type QuoteMenuAction,
} from "./quote-row-menu";

type QuoteTableProps = {
  quotes: QuoteRecord[];
  customers: Array<{ id: string; name: string }>;
  selectedIds: string[];
  caps: QuoteCaps;
  /** Selection only feeds the bulk export. */
  canSelect: boolean;
  onToggleCheck: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
  onNextAction: (id: string) => void;
  onMenuAction: (id: string, action: QuoteMenuAction) => void;
};

const cell = "min-w-0 overflow-hidden";

export function QuoteTable({
  quotes,
  customers,
  selectedIds,
  caps,
  canSelect,
  onToggleCheck,
  onToggleAll,
  onOpen,
  onNextAction,
  onMenuAction,
}: QuoteTableProps) {
  const t = useTranslations("register");
  const statusT = useTranslations("status");
  const workT = useTranslations();
  const locale = useLocale();
  const allChecked = quotes.length > 0 && selectedIds.length === quotes.length;
  const showNext = hasQuoteNextActions(caps);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });

  return (
    <DashboardScroll scrollClassName="overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-[960px] table-fixed border-separate border-spacing-0 text-left xl:min-w-0">
        <colgroup>
          {canSelect ? <col style={{ width: 36 }} /> : null}
          <col style={{ width: 120 }} />
          <col />
          <col style={{ width: 140 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 110 }} />
          {showNext ? <col style={{ width: 110 }} /> : null}
          <col style={{ width: 44 }} />
        </colgroup>
        <thead className="dashboard-list__head">
          <tr>
            {canSelect ? (
              <th className={cell}>
                <input
                  aria-label={t("table.selectAll")}
                  checked={allChecked}
                  className="h-3.5 w-3.5 accent-[#044ce2]"
                  onChange={onToggleAll}
                  type="checkbox"
                />
              </th>
            ) : null}
            <th className={cell}>{t("number")}</th>
            <th className={cell}>{t("customer")}</th>
            <th className={cell}>{t("owner")}</th>
            <th className={`${cell} text-right`}>{t("total")}</th>
            <th className={cell}>{t("status")}</th>
            <th className={cell}>{t("validity")}</th>
            {showNext ? <th className={cell}>{t("next")}</th> : null}
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => {
            const owner = ownerById(quote.ownerId);
            const name = customerName(customers, quote.customerId);
            const work = workT(quote.workKey);
            const amount = formatMoneyFromCents(quoteTotals(quote).ttcCents);
            const next = nextActionFor(quote);
            const action = allowedQuoteAction(next.kind, caps);
            const checked = selectedIds.includes(quote.id);
            const validLabel = dateFmt.format(new Date(`${quote.validUntil}T00:00:00`));

            return (
              <tr className="dashboard-list__row" key={quote.id}>
                {canSelect ? (
                  <td className={cell}>
                    <input
                      aria-label={t("table.selectRow", { id: quote.id })}
                      checked={checked}
                      className="h-3.5 w-3.5 accent-[#044ce2]"
                      onChange={() => onToggleCheck(quote.id)}
                      type="checkbox"
                    />
                  </td>
                ) : null}
                <td className={cell}>
                  <button
                    className="dashboard-list__primary dashboard-list__link max-w-full truncate text-left tabular-nums"
                    onClick={() => onOpen(quote.id)}
                    title={quote.id}
                    type="button"
                  >
                    {quote.id}
                  </button>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__primary" title={name}>
                    {name}
                  </span>
                  <span className="dashboard-list__secondary" title={work}>
                    {work}
                  </span>
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
                <td className={`${cell} text-right`}>
                  <span className="dashboard-list__amount block truncate" title={amount}>
                    {amount}
                  </span>
                </td>
                <td className={cell}>
                  <StatusBadge
                    className="dashboard-list__badge max-w-full"
                    size="xs"
                    tone={quoteStatusTone[quote.status]}
                  >
                    {statusT(quote.status)}
                  </StatusBadge>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__secondary tabular-nums">{validLabel}</span>
                </td>
                {showNext ? (
                  <td className={cell}>
                    {action === null ? (
                      <span className="dashboard-list__secondary">—</span>
                    ) : (
                      <button
                        className={cn(
                          "action-motion soft-button h-7 rounded-[8px] px-2 text-[11px] font-semibold text-[#044ce2]",
                          next.urgent && "ring-1 ring-[#f1b86b]/80",
                        )}
                        onClick={() => onNextAction(quote.id)}
                        type="button"
                      >
                        {t(`actions.${action}`)}
                      </button>
                    )}
                  </td>
                ) : null}
                <td className={cell}>
                  <QuoteRowMenu
                    caps={caps}
                    onAction={(action) => onMenuAction(quote.id, action)}
                    quote={quote}
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
