"use client";

import { ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Invoice } from "@/mocks/dashboard/types";

import { DashboardScroll } from "./dashboard-scroll";
import { IconTile, StatusBadge } from "./tone";

export function InvoicesToFollow({
  invoices,
  onOpenInvoice,
}: {
  invoices: Invoice[];
  onOpenInvoice?: (id: string) => void;
}) {
  const t = useTranslations();

  return (
    <DashboardScroll>
      {invoices.length === 0 ? (
        <p className="py-6 text-sm text-[#728097]">{t("invoices.empty")}</p>
      ) : (
        <div className="space-y-1.5">
          {invoices.map((invoice) => (
            <button
              className="interactive-row soft-list-item flex min-h-[42px] w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left"
              key={invoice.id}
              type="button"
              onClick={() => onOpenInvoice?.(invoice.id)}
            >
              <IconTile size="xs" tone={invoice.tone} icon={ReceiptText} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] leading-tight font-semibold text-[#24334c]">
                  {invoice.id} - {invoice.customer}
                </span>
                <span className="mt-0.5 block truncate text-[9px] leading-tight text-[#7a899e]">
                  {t("invoices.due", { date: invoice.due })}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <strong className="text-[10px] whitespace-nowrap text-[#24334c] tabular-nums">
                  {invoice.balance}
                </strong>
                <StatusBadge size="xs" tone={invoice.tone}>
                  {t(invoice.statusKey)}
                </StatusBadge>
              </span>
            </button>
          ))}
        </div>
      )}
    </DashboardScroll>
  );
}
