"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { FormSheet } from "@/components/forms/form-sheet";
import { quoteTotals, type QuoteRecord } from "@/features/quotes/model";
import { Link } from "@/i18n/navigation";
import { formatMoneyFromCents } from "@/lib/money";

export function SelectQuoteSheet({
  open,
  quotes,
  onClose,
  onSelect,
}: {
  open: boolean;
  quotes: Array<QuoteRecord & { customerName: string }>;
  onClose: () => void;
  onSelect: (quoteId: string) => void;
}) {
  const t = useTranslations("invoices.selectQuote");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return quotes;
    return quotes.filter((quote) =>
      `${quote.id} ${quote.customerName}`.toLowerCase().includes(needle),
    );
  }, [quotes, query]);

  return (
    <FormSheet
      closeLabel={t("close")}
      description={t("body")}
      open={open}
      title={t("title")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[70]"
      onClose={() => {
        setQuery("");
        setSelectedId(null);
        onClose();
      }}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <button
            className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
            onClick={onClose}
            type="button"
          >
            {t("cancel")}
          </button>
          <button
            className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-40"
            disabled={!selectedId}
            onClick={() => {
              if (selectedId) onSelect(selectedId);
            }}
            type="button"
          >
            {t("continue")}
          </button>
        </div>
      }
    >
      {quotes.length === 0 ? (
        <div className="space-y-2 py-6 text-center">
          <p className="text-sm font-semibold text-[#24334c]">{t("emptyTitle")}</p>
          <p className="text-xs leading-5 text-[#7d8aa0]">{t("emptyBody")}</p>
          <Link
            className="action-motion soft-primary mt-2 inline-flex h-9 items-center rounded-[9px] px-3 text-xs font-semibold text-white"
            href="/devis"
          >
            {t("goToQuotes")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="soft-input flex h-9 items-center gap-2 rounded-[9px] px-2.5">
            <Search aria-hidden="true" className="h-3.5 w-3.5 text-[#8a97ab]" />
            <input
              aria-label={t("search")}
              className="min-w-0 flex-1 bg-transparent text-xs text-[#24334c] outline-none placeholder:text-[#98a4b5]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search")}
              type="search"
              value={query}
            />
          </label>
          <ul className="space-y-1.5">
            {filtered.map((quote) => {
              const active = selectedId === quote.id;
              return (
                <li key={quote.id}>
                  <button
                    className={
                      active
                        ? "flex w-full items-center justify-between gap-3 rounded-[10px] bg-[#eef4ff] px-3 py-2.5 text-left ring-1 ring-[#044ce2]/20"
                        : "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left hover:bg-[#f7faff]"
                    }
                    onClick={() => setSelectedId(quote.id)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold tabular-nums text-[#044ce2]">
                        {quote.id}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#516078]">
                        {quote.customerName}
                      </span>
                    </span>
                    <strong className="shrink-0 text-sm font-semibold tabular-nums text-[#102342]">
                      {formatMoneyFromCents(quoteTotals(quote).ttcCents)}
                    </strong>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </FormSheet>
  );
}
