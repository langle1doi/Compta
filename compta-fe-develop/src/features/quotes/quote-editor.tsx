"use client";

import { AmountInput } from "@/components/compte/amount-input";
import { SoftSelect } from "@/components/compte/soft-select";
import { DocumentStatus } from "@/components/status/document-status";
import { formatMoneyFromCents, parseAmount, sanitizeIntegerInput } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { customerName, ownerById } from "@/features/quotes/query";
import { quoteTotals } from "@/features/quotes/model";
import {
  effectiveUnitPriceCents,
} from "@/features/products/model";
import {
  useCustomerProductPrices,
  useProducts,
} from "@/features/products/store";
import { productsForCompany } from "@/features/products/query";
import { can } from "@/features/settings/can";
import { useCurrentCompany } from "@/features/settings/company-store";
import { usePermissions } from "@/features/settings/session-provider";
import { hydrateLedger, updateQuote, useHydrated, useLedger } from "@/features/quotes/store";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

export function QuoteEditor({ id }: { id: string }) {
  const t = useTranslations("register");
  const work = useTranslations();
  const ledger = useLedger();
  const ready = useHydrated();
  const activePermissions = usePermissions();
  const { companyId } = useCurrentCompany();
  const productsAll = useProducts();
  const customerPrices = useCustomerProductPrices();
  const catalog = useMemo(
    () =>
      productsForCompany(productsAll, companyId).filter((item) => item.status === "active"),
    [companyId, productsAll],
  );

  const lineSeq = useRef(0);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    hydrateLedger();
  }, []);

  const canSend = can(activePermissions, "quote.send");
  const canUpdate = can(activePermissions, "quote.update");
  const quote = ledger.quotes.find((item) => item.id === id);
  if (!ready) return <p className="p-8 text-sm text-[#728097]">{t("loading")}</p>;
  if (!quote) return <p className="p-8 text-sm text-[#728097]">{t("editor.missing")}</p>;

  const totals = quoteTotals(quote);
  const catalogOptions = [
    { value: "", label: t("editor.freeLine") },
    ...catalog.map((item) => ({
      value: item.id,
      label: `${item.code} · ${item.name}`,
    })),
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <Link className="text-sm font-semibold text-[#044ce2]" href="/devis">
        {t("editor.back")}
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#044ce2]">{quote.id}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#063586]">
            {customerName(ledger.customers, quote.customerId)}
          </h2>
          <p className="mt-1 text-sm text-[#728097]">{work(quote.workKey)}</p>
        </div>
        <DocumentStatus status={quote.status} />
      </div>
      <p className="mt-4 text-sm text-[#405069]">
        {t("preview.valid", { date: quote.validUntil.split("-").reverse().join("/") })} · {ownerById(quote.ownerId)?.name}
      </p>
      <section className="mt-6 overflow-hidden rounded-[18px] bg-white ring-1 ring-[#e1e7f1]">
        <div className="flex items-center justify-between border-b border-[#edf1f6] px-5 py-4">
          <h3 className="text-sm font-semibold text-[#063586]">{t("editor.lines")}</h3>
          {canUpdate ? (
            <button
              className="text-sm font-semibold text-[#044ce2]"
              type="button"
              onClick={() => {
                lineSeq.current += 1;
                updateQuote(quote.id, {
                  lines: [
                    ...quote.lines,
                    { id: `line-${lineSeq.current}`, label: "", qty: 1, unitHtCents: 0 },
                  ],
                });
              }}
            >
              {t("editor.add")}
            </button>
          ) : null}
        </div>
        {quote.lines.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#728097]">{t("editor.emptyLines")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[#8b97a8]">
              <tr>
                <th className="px-5 py-2 font-medium">{t("editor.description")}</th>
                <th className="px-3 py-2 font-medium">{t("editor.qty")}</th>
                <th className="px-5 py-2 text-right font-medium">{t("editor.unit")}</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((line) => (
                <tr key={line.id} className="border-t border-[#edf1f6]">
                  <td className="px-5 py-2">
                    <div className="space-y-1.5">
                      {canUpdate && quote.status === "draft" ? (
                        <SoftSelect
                          hideLabel
                          label={t("editor.catalog")}
                          options={catalogOptions}
                          value={line.productId ?? ""}
                          onChange={(value) => {
                            if (!value) {
                              updateQuote(quote.id, {
                                lines: quote.lines.map((item) =>
                                  item.id === line.id
                                    ? { ...item, productId: undefined }
                                    : item,
                                ),
                              });
                              return;
                            }
                            const product = catalog.find((item) => item.id === value);
                            if (!product) return;
                            const unitHtCents = effectiveUnitPriceCents(
                              product,
                              quote.customerId,
                              customerPrices,
                            );
                            updateQuote(quote.id, {
                              lines: quote.lines.map((item) =>
                                item.id === line.id
                                  ? {
                                      ...item,
                                      productId: product.id,
                                      label: product.description || product.name,
                                      unitHtCents,
                                    }
                                  : item,
                              ),
                            });
                          }}
                        />
                      ) : null}
                      {canUpdate ? (
                        <input
                          className="h-9 w-full rounded-[8px] border border-[#dfe6f1] px-2"
                          value={line.label}
                          onChange={(event) =>
                            updateQuote(quote.id, {
                              lines: quote.lines.map((item) =>
                                item.id === line.id
                                  ? { ...item, label: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      ) : (
                        <p className="py-1.5 text-[#24334c]">{line.label || "—"}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {canUpdate ? (
                      <AmountInput
                        className="h-9 w-16 rounded-[8px] border border-[#dfe6f1] px-2 text-[#24334c]"
                        mode="integer"
                        value={String(line.qty)}
                        onValueChange={(raw) => {
                          const digits = sanitizeIntegerInput(raw);
                          updateQuote(quote.id, {
                            lines: quote.lines.map((item) =>
                              item.id === line.id
                                ? { ...item, qty: Math.max(1, Number(digits) || 1) }
                                : item,
                            ),
                          });
                        }}
                      />
                    ) : (
                      <span className="tabular-nums text-[#24334c]">{line.qty}</span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-right">
                    {canUpdate ? (
                      <AmountInput
                        className="h-9 w-28 rounded-[8px] border border-[#dfe6f1] px-2 text-right text-[#24334c]"
                        disabled={quote.status !== "draft"}
                        value={
                          priceDrafts[line.id] ??
                          (line.unitHtCents === 0
                            ? ""
                            : String(line.unitHtCents / 100).replace(".", ","))
                        }
                        onValueChange={(raw) => {
                          setPriceDrafts((current) => ({ ...current, [line.id]: raw }));
                          updateQuote(quote.id, {
                            lines: quote.lines.map((item) =>
                              item.id === line.id
                                ? {
                                    ...item,
                                    unitHtCents: Math.round(parseAmount(raw) * 100) || 0,
                                  }
                                : item,
                            ),
                          });
                        }}
                      />
                    ) : (
                      <span className="tabular-nums text-[#24334c]">
                        {formatMoneyFromCents(line.unitHtCents)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl className="space-y-2 border-t border-[#edf1f6] px-5 py-4 text-sm">
          <div className="flex justify-between"><dt className="text-[#728097]">{t("preview.ht")}</dt><dd className="tabular-nums">{formatMoneyFromCents(totals.htCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-[#728097]">{t("preview.vat", { rate: quote.vatRate })}</dt><dd className="tabular-nums">{formatMoneyFromCents(totals.vatCents)}</dd></div>
          <div className="flex justify-between text-base font-semibold text-[#063586]"><dt>{t("preview.ttc")}</dt><dd className="tabular-nums">{formatMoneyFromCents(totals.ttcCents)}</dd></div>
        </dl>
      </section>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {canUpdate ? (
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            onClick={() => {
              updateQuote(quote.id, { status: quote.status === "draft" ? "draft" : quote.status });
              setNotice(t("editor.saved"));
            }}
            type="button"
          >
            {t("editor.saveDraft")}
          </button>
        ) : null}
        {canSend ? (
          <button
            className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-40"
            disabled={quote.status !== "draft" || quote.lines.length === 0}
            onClick={() => {
              if (quote.status !== "draft" || quote.lines.length === 0) return;
              updateQuote(quote.id, {
                status: "sent",
                activity: [
                  {
                    id: `${quote.id}-sent-${Date.now()}`,
                    at: "2026-10-02",
                    messageKey: "activity.quoteSent",
                    values: { id: quote.id },
                  },
                  ...quote.activity,
                ],
              });
              setNotice(t("editor.sent"));
            }}
            type="button"
          >
            {t("editor.send")}
          </button>
        ) : null}
      </div>
      {notice ? <p className="mt-3 text-sm text-[#0f8a5f]">{notice}</p> : null}
    </div>
  );
}
