"use client";

import { useTranslations } from "next-intl";

import { FormSheet } from "@/components/forms/form-sheet";
import { useCan } from "@/features/settings/can";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { agingBucketColor } from "../chart-palette";
import type { ExportResult } from "../export";
import { exportAgingCsv } from "../export";
import type { AgingBucket, AgingBucketId, AgingDetailRow } from "../model";
import { ReportCard } from "./report-card";
import { ReportExportButton } from "./report-export-button";

export function ReceivableAgingReport({
  buckets,
  details,
  totalCents,
  drillBucket,
  onDrill,
  onCloseDrill,
  onEmptyExport,
}: {
  buckets: AgingBucket[];
  details: AgingDetailRow[];
  totalCents: number;
  drillBucket: AgingBucketId | null;
  onDrill: (bucket: AgingBucketId) => void;
  onCloseDrill: () => void;
  onEmptyExport: () => void;
}) {
  const t = useTranslations("reports");
  const canOpenInvoices = useCan()("invoice.read");
  const empty = totalCents === 0;
  const drillRows = drillBucket
    ? details.filter((row) => row.agingBucket === drillBucket)
    : [];

  function handleExport(): ExportResult {
    const result = exportAgingCsv(details, new Date().toISOString().slice(0, 10));
    if (!result.ok) onEmptyExport();
    return result;
  }

  return (
    <>
      <ReportCard
        title={t("aging.title")}
        subtitle={t("aging.subtitle")}
        empty={empty}
        emptyTitle={t("empty.reportTitle")}
        emptyBody={t("empty.reportBody")}
        action={
          <>
            {canOpenInvoices ? (
              <Link
                className="action-motion inline-flex h-8 items-center rounded-[8px] px-2 text-[11px] font-semibold text-[var(--dashboard-link)] hover:bg-[var(--dashboard-soft-blue)]"
                href="/factures"
              >
                {t("aging.viewOverdue")}
              </Link>
            ) : null}
            <ReportExportButton
              generatingLabel={t("export.generating")}
              label={t("export.csv")}
              onExport={handleExport}
            />
          </>
        }
      >
        <p className="mb-2.5 shrink-0 text-[13px] font-semibold text-[#132642] tabular-nums">
          {t("aging.total", { amount: formatMoneyFromCents(totalCents) })}
        </p>
        <div
          className="mb-3 flex h-[11px] shrink-0 overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--report-chart-track)" }}
        >
          {buckets.map((bucket) =>
            bucket.amountCents > 0 ? (
              <button
                key={bucket.id}
                aria-label={t(`aging.buckets.${bucket.id}`)}
                className="h-full min-w-0 transition-opacity hover:opacity-90"
                style={{
                  width: `${Math.max(1.5, bucket.sharePercent * 100)}%`,
                  backgroundColor: agingBucketColor[bucket.id],
                }}
                type="button"
                onClick={() => onDrill(bucket.id)}
              />
            ) : null,
          )}
        </div>
        <div className="grid grid-cols-2 content-start gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {buckets.map((bucket) => (
            <button
              key={bucket.id}
              className={cn(
                "rounded-[8px] px-0.5 py-0.5 text-left transition-colors hover:bg-[rgb(245_248_253/0.8)]",
                drillBucket === bucket.id && "bg-[var(--dashboard-soft-blue)]",
              )}
              type="button"
              onClick={() => onDrill(bucket.id)}
            >
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#7a899e]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: agingBucketColor[bucket.id] }}
                />
                {t(`aging.buckets.${bucket.id}`)}
              </p>
              <p className="mt-1 text-[12px] font-semibold text-[#132642] tabular-nums">
                {formatMoneyFromCents(bucket.amountCents)}
              </p>
              <p className="text-[11px] text-[#98a4b5] tabular-nums">
                {formatPercent(bucket.sharePercent)}
              </p>
            </button>
          ))}
        </div>
      </ReportCard>

      <FormSheet
        open={drillBucket !== null}
        title={
          drillBucket
            ? t("aging.drillTitle", { bucket: t(`aging.buckets.${drillBucket}`) })
            : t("aging.title")
        }
        description={t("aging.drillBody")}
        onClose={onCloseDrill}
        widthClassName="sm:max-w-[720px]"
        closeLabel={t("close")}
        contentClassName="overflow-auto p-0"
      >
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-[#f8fafc] text-[10px] font-semibold tracking-wide text-[#7d8aa0] uppercase">
              <tr>
                <th className="px-3 py-2">{t("aging.columns.invoice")}</th>
                <th className="px-3 py-2">{t("aging.columns.customer")}</th>
                <th className="px-3 py-2">{t("aging.columns.issue")}</th>
                <th className="px-3 py-2">{t("aging.columns.due")}</th>
                <th className="px-3 py-2">{t("aging.columns.days")}</th>
                <th className="px-3 py-2">{t("aging.columns.total")}</th>
                <th className="px-3 py-2">{t("aging.columns.paid")}</th>
                <th className="px-3 py-2">{t("aging.columns.remaining")}</th>
              </tr>
            </thead>
            <tbody>
              {drillRows.map((row) => (
                <tr className="border-t border-[#edf2f8]" key={row.invoiceId}>
                  <td className="px-3 py-2 font-semibold text-[#044ce2]">
                    {canOpenInvoices ? (
                      <Link href={`/factures?invoice=${row.invoiceId}`}>{row.invoiceNumber}</Link>
                    ) : (
                      row.invoiceNumber
                    )}
                  </td>
                  <td className="px-3 py-2 text-[#24334c]">{row.customerName}</td>
                  <td className="px-3 py-2 tabular-nums text-[#516078]">{row.issueDate}</td>
                  <td className="px-3 py-2 tabular-nums text-[#516078]">{row.dueDate}</td>
                  <td className="px-3 py-2 tabular-nums text-[#516078]">{row.daysOverdue}</td>
                  <td className="px-3 py-2 tabular-nums text-[#102342]">
                    {formatMoneyFromCents(row.invoiceTotalCents)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#516078]">
                    {formatMoneyFromCents(row.paidCents)}
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums text-[#102342]">
                    {formatMoneyFromCents(row.remainingCents)}
                  </td>
                </tr>
              ))}
              {drillRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-[#7d8aa0]" colSpan={8}>
                    {t("empty.reportBody")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </FormSheet>
    </>
  );
}
