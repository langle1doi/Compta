"use client";

import { useTranslations } from "next-intl";

import type { Quote } from "@/mocks/dashboard/types";

import { DashboardScroll } from "./dashboard-scroll";
import { StatusBadge } from "./tone";

const columnWidths: Array<number | undefined> = [undefined, 240, 64, undefined, undefined];
const cell = "min-w-0 overflow-hidden";

export function RecentQuotesTable({
  quotes,
  onOpenQuote,
}: {
  quotes: Quote[];
  onOpenQuote?: (id: string) => void;
}) {
  const t = useTranslations();

  return (
    <DashboardScroll scrollClassName="overflow-x-auto overflow-y-auto">
      {quotes.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[#728097]">{t("quotes.empty")}</p>
      ) : (
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={index} style={width ? { width } : undefined} />
            ))}
          </colgroup>
          <thead className="dashboard-list__head">
            <tr>
              <th className={cell}>
                <span className="block truncate" title={t("quotes.number")}>
                  {t("quotes.number")}
                </span>
              </th>
              <th className={cell}>
                <span className="block truncate" title={t("quotes.customer")}>
                  {t("quotes.customer")}
                </span>
              </th>
              <th className={cell}>
                <span className="block truncate" title={t("quotes.owner")}>
                  {t("quotes.owner")}
                </span>
              </th>
              <th className={`${cell} text-right`}>
                <span className="block truncate" title={t("quotes.total")}>
                  {t("quotes.total")}
                </span>
              </th>
              <th className={cell}>
                <span className="block truncate" title={t("quotes.status")}>
                  {t("quotes.status")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const work = t(quote.workKey);

              return (
                <tr className="dashboard-list__row" key={quote.id}>
                  <td className={cell}>
                    <button
                      className="dashboard-list__primary dashboard-list__link max-w-full text-left tabular-nums"
                      title={quote.id}
                      type="button"
                      onClick={() => onOpenQuote?.(quote.id)}
                    >
                      {quote.id}
                    </button>
                  </td>
                  <td className={cell}>
                    <span className="dashboard-list__primary" title={quote.customer}>
                      {quote.customer}
                    </span>
                    <span className="dashboard-list__secondary" title={work}>
                      {work}
                    </span>
                  </td>
                  <td className={cell}>
                    <span className="dashboard-list__avatar" title={quote.owner}>
                      {quote.owner}
                    </span>
                  </td>
                  <td className={cell}>
                    <span className="dashboard-list__amount block truncate" title={quote.amount}>
                      {quote.amount}
                    </span>
                  </td>
                  <td className={cell}>
                    <StatusBadge className="dashboard-list__badge max-w-full" size="xs" tone={quote.tone}>
                      {t(quote.statusKey)}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </DashboardScroll>
  );
}
