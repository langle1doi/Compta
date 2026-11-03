"use client";

import { WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/compte/confirm-dialog";
import { PageSizeSelect } from "@/components/compte/page-size-select";
import { SoftToast } from "@/components/compte/soft-toast";
import { FormSheet } from "@/components/forms/form-sheet";
import {
  invoiceDisplayNumber,
  remainingCentsFor,
} from "@/features/invoices/model";
import {
  clearBankMatchSuggestion,
  matchBankTransaction,
  recordPayment,
  useBankTransactions,
  useInvoicePayments,
  useInvoices,
  usePaymentActivities,
} from "@/features/invoices/store";
import { hydrateLedger, useLedger } from "@/features/quotes/store";
import { can } from "@/features/settings/can";
import { useCurrentCompany } from "@/features/settings/company-store";
import { usePermissions } from "@/features/settings/session-provider";
import { useRouter } from "@/i18n/navigation";
import { centsToCsvEuro, downloadCsv, mockExportFilename } from "@/lib/csv-export";
import { formatMoneyFromCents } from "@/lib/money";

import { CollectionFollowUpSheet } from "./components/collection-follow-up-sheet";
import { PaymentDetailsPanel } from "./components/payment-details-panel";
import { PaymentKpisStrip } from "./components/payment-kpis";
import { PaymentMobileList } from "./components/payment-mobile-list";
import { PaymentRail } from "./components/payment-rail";
import { PaymentTable } from "./components/payment-table";
import { PaymentToolbar } from "./components/payment-toolbar";
import { RecordPaymentSheet } from "./components/record-payment-sheet";
import { ReconciliationQueueSheet } from "./components/reconciliation-queue-sheet";
import { ReviewMatchSheet } from "./components/review-match-sheet";
import { getPaymentKpis } from "./kpis";
import {
  emptyPaymentFilters,
  paymentListStatus,
  paymentNextAction,
  type PaymentFilters,
  type PaymentListStatus,
} from "./model";
import { useReminderEvents } from "./reminders";
import {
  bankTransactionsForCompany,
  eligibleInvoicesForPayment,
  invoicesForCompany,
  matchesPaymentFilters,
  methodsInUse,
  paymentsForCompany,
  sortPayments,
  unmatchedBankTransactions,
} from "./query";

const pageSizeOptions = [5, 10, 25, 50] as const;

export function PaymentsWorkspace() {
  const t = useTranslations("payments");
  const router = useRouter();
  const { companyId } = useCurrentCompany();
  const invoicesAll = useInvoices();
  const paymentsAll = useInvoicePayments();
  const bankAll = useBankTransactions();
  const activitiesAll = usePaymentActivities();
  const ledger = useLedger();
  const [filters, setFilters] = useState<PaymentFilters>(emptyPaymentFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordInvoiceId, setRecordInvoiceId] = useState<string | null>(null);
  const [followUpInvoiceId, setFollowUpInvoiceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchInvoiceId, setMatchInvoiceId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const viewAllRef = useRef<HTMLButtonElement>(null);
  const reminderEvents = useReminderEvents();

  useEffect(() => {
    hydrateLedger();
  }, []);

  const activePermissions = usePermissions();
  const canRead = can(activePermissions, "payment.read");
  const canCreate = can(activePermissions, "payment.create");
  const canReconcile = can(activePermissions, "payment.manage");
  const canExport = can(activePermissions, "payment.read");
  const canOpenInvoice = can(activePermissions, "invoice.read");
  // Payment reminders belong to whoever handles collections.
  const canFollowUp = canCreate || canReconcile;

  const invoices = useMemo(
    () => invoicesForCompany(invoicesAll, companyId),
    [companyId, invoicesAll],
  );
  const payments = useMemo(
    () => paymentsForCompany(paymentsAll, invoicesAll, companyId),
    [companyId, invoicesAll, paymentsAll],
  );
  const bankTransactions = useMemo(
    () => bankTransactionsForCompany(bankAll, companyId),
    [bankAll, companyId],
  );
  const queue = useMemo(
    () => unmatchedBankTransactions(bankTransactions),
    [bankTransactions],
  );
  const invoicesById = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );
  const eligible = useMemo(
    () => eligibleInvoicesForPayment(invoicesAll, paymentsAll, companyId),
    [companyId, invoicesAll, paymentsAll],
  );
  const methods = useMemo(() => methodsInUse(payments), [payments]);
  const kpis = useMemo(() => getPaymentKpis(invoices, payments), [invoices, payments]);

  const filtered = useMemo(() => {
    const matched = payments.filter((payment) =>
      matchesPaymentFilters(payment, invoicesById.get(payment.invoiceId), payments, filters),
    );
    return sortPayments(matched, "newest");
  }, [filters, invoicesById, payments]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeFrom = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeTo = Math.min(filtered.length, (safePage + 1) * pageSize);
  const filteredTotal = filtered.reduce((sum, payment) => sum + payment.amountCents, 0);
  const hasActiveFilters =
    Boolean(filters.query.trim()) ||
    filters.status !== "all" ||
    filters.method !== "all" ||
    Boolean(filters.customerId) ||
    Boolean(filters.invoiceId) ||
    filters.datePreset !== "any" ||
    filters.reconciliation !== "all";

  const selectedPayment = payments.find((payment) => payment.id === selectedId) ?? null;
  const selectedInvoice = selectedPayment
    ? invoicesById.get(selectedPayment.invoiceId)
    : undefined;
  const followUpInvoice = followUpInvoiceId
    ? (invoicesById.get(followUpInvoiceId) ??
      invoicesAll.find((item) => item.id === followUpInvoiceId) ??
      null)
    : null;
  const selectedBank = selectedPayment?.bankTransactionId
    ? bankTransactions.find((item) => item.id === selectedPayment.bankTransactionId)
    : undefined;
  const selectedActivities = activitiesAll.filter(
    (item) => item.paymentId === selectedPayment?.id,
  );
  const matchTx = matchId
    ? bankTransactions.find((item) => item.id === matchId) ?? null
    : null;
  const matchInvoice = matchInvoiceId ? invoicesById.get(matchInvoiceId) : undefined;
  const reviewTx = reviewId
    ? bankTransactions.find((item) => item.id === reviewId) ?? null
    : null;

  function mutationMessage(error: string) {
    if (error === "overpayment") return t("record.overpayment");
    if (error === "not_eligible") return t("record.noInvoices");
    if (error === "invalid_amount") return t("record.invalidAmount");
    if (error === "already_matched") return t("queue.alreadyMatched");
    return t("record.failed");
  }

  function openMatch(transactionId: string, invoiceId?: string) {
    const transaction = bankTransactions.find((item) => item.id === transactionId);
    const resolved = invoiceId ?? transaction?.suggestedInvoiceId;
    if (!resolved) return;
    setFormError(null);
    setMatchId(transactionId);
    setMatchInvoiceId(resolved);
  }

  function openPayment(id: string) {
    setSelectedId(id);
  }

  function openRecord(invoiceId?: string) {
    setFormError(null);
    setRecordInvoiceId(invoiceId ?? null);
    setRecordOpen(true);
  }

  function exportPaymentsCsv() {
    const headers = [
      "reference",
      "customer",
      "invoice",
      "method",
      "date",
      "amount_eur",
      "remaining_eur",
      "status",
      "reconciliation",
      "bank_reference",
      "data_source",
    ];
    const rows = filtered.map((payment) => {
      const invoice = invoicesById.get(payment.invoiceId);
      const remaining = invoice ? remainingCentsFor(invoice, payments) : 0;
      return [
        payment.reference,
        invoice?.customerName ?? "",
        invoice ? invoiceDisplayNumber(invoice) : payment.invoiceId,
        payment.method,
        payment.date,
        centsToCsvEuro(payment.amountCents),
        centsToCsvEuro(remaining),
        paymentListStatus(payment, invoice, payments),
        payment.reconciliationStatus,
        payment.bankReference ?? "",
        "mock",
      ];
    });
    const { rowCount } = downloadCsv(mockExportFilename("payments"), headers, rows);
    setNotice(t("exportDone", { count: rowCount }));
  }

  function handleNextAction(id: string) {
    const payment = payments.find((item) => item.id === id);
    if (!payment) return;
    const invoice = invoicesById.get(payment.invoiceId);
    const next = paymentNextAction(invoice, payments);
    if (next === "view") {
      openPayment(id);
      return;
    }
    if (next === "follow_up") {
      if (canFollowUp) setFollowUpInvoiceId(payment.invoiceId);
      else openPayment(id);
      return;
    }
    if (!canCreate) {
      openPayment(id);
      return;
    }
    openRecord(payment.invoiceId);
  }

  function runSave(task: () => { ok: boolean; error?: string }) {
    if (saving) return;
    setSaving(true);
    window.setTimeout(() => {
      const result = task();
      setSaving(false);
      if (!result.ok) {
        setFormError(mutationMessage(result.error ?? "failed"));
        return;
      }
      setFormError(null);
      setRecordOpen(false);
      setRecordInvoiceId(null);
      setMatchId(null);
      setMatchInvoiceId(null);
      setReviewId(null);
      setNotice(t("notices.recorded"));
    }, 280);
  }

  if (!canRead) {
    return (
      <main className="dashboard-canvas flex min-h-0 flex-1 items-center justify-center">
        <p className="text-sm text-[#7d8aa0]">{t("forbidden")}</p>
      </main>
    );
  }

  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="app-scroll dashboard-page flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto lg:min-h-0 lg:overflow-hidden" data-scroll-chain-page="true">
        <div className="dashboard-enter enter-0 min-w-0 shrink-0 overflow-visible">
          <PaymentKpisStrip kpis={kpis} />
        </div>

        <div className="dashboard-enter enter-1 flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:overflow-hidden">
          <section className="dashboard-card dashboard-list flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden sm:min-h-[320px]">
              <PaymentToolbar
                canCreate={canCreate}
                customers={ledger.customers}
                filters={filters}
                invoices={invoices
                  .filter((invoice) => payments.some((payment) => payment.invoiceId === invoice.id))
                  .map((invoice) => ({
                    id: invoice.id,
                    label: invoiceDisplayNumber(invoice),
                  }))}
                methods={methods}
                query={filters.query}
                status={filters.status}
                method={filters.method}
                onClearFilters={() => {
                  setFilters(emptyPaymentFilters);
                  setPage(0);
                }}
                onCreate={() => openRecord()}
                onExport={canExport ? exportPaymentsCsv : undefined}
                onFiltersChange={(patch) => {
                  setPage(0);
                  setFilters((current) => ({ ...current, ...patch }));
                }}
                onMethodChange={(value) => {
                  setPage(0);
                  setFilters((current) => ({ ...current, method: value }));
                }}
                onQueryChange={(value) => {
                  setPage(0);
                  setFilters((current) => ({ ...current, query: value }));
                }}
                onStatusChange={(value) => {
                  setPage(0);
                  setFilters((current) => ({ ...current, status: value as PaymentListStatus | "all" }));
                }}
              />

              {filtered.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                  <WalletCards aria-hidden="true" className="h-8 w-8 text-[#b7c3d6]" />
                  <p className="text-sm font-semibold text-[#24334c]">
                    {hasActiveFilters ? t("emptyFilteredTitle") : t("emptyTitle")}
                  </p>
                  <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">
                    {hasActiveFilters ? t("emptyFilteredBody") : t("emptyBody")}
                  </p>
                  {hasActiveFilters ? (
                    <button
                      className="action-motion soft-button mt-2 h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
                      onClick={() => setFilters(emptyPaymentFilters)}
                      type="button"
                    >
                      {t("emptyClear")}
                    </button>
                  ) : canCreate && eligible.length > 0 ? (
                    <button
                      className="action-motion soft-primary mt-2 h-9 rounded-[9px] px-3 text-xs font-semibold text-white"
                      onClick={() => openRecord()}
                      type="button"
                    >
                      {t("recordAction")}
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex">
                    <PaymentTable
                      canFollowUp={canFollowUp}
                      canRecord={canCreate}
                      invoicesById={invoicesById}
                      ledgerPayments={payments}
                      payments={visible}
                      selectedId={selectedId}
                      selectedIds={selectedIds}
                      onNextAction={handleNextAction}
                      onOpen={openPayment}
                      onOpenInvoice={
                        canOpenInvoice
                          ? (invoiceId) => router.push(`/factures?invoice=${invoiceId}`)
                          : undefined
                      }
                      onToggleAll={() => {
                        setSelectedIds((current) =>
                          current.length === visible.length ? [] : visible.map((item) => item.id),
                        );
                      }}
                      onToggleCheck={(id) => {
                        setSelectedIds((current) =>
                          current.includes(id)
                            ? current.filter((item) => item !== id)
                            : [...current, id],
                        );
                      }}
                    />
                  </div>
                  <PaymentMobileList
                    canFollowUp={canFollowUp}
                    canRecord={canCreate}
                    invoicesById={invoicesById}
                    ledgerPayments={payments}
                    payments={visible}
                    onNextAction={handleNextAction}
                    onOpen={openPayment}
                  />
                </>
              )}

              <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#edf2f8] px-3.5 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-[11px] text-[#7d8aa0]">
                    {t("pagination.summary", {
                      from: rangeFrom,
                      to: rangeTo,
                      total: filtered.length,
                    })}
                    <span className="mx-1.5 text-[#c5ceda]">·</span>
                    {t("footerValue", { amount: formatMoneyFromCents(filteredTotal) })}
                  </p>
                  <PageSizeSelect
                    formatOption={(count) =>
                      t("pagination.rowsPerPage", { count })
                    }
                    label={t("pagination.pageSize")}
                    options={pageSizeOptions}
                    value={pageSize}
                    onChange={(size) => {
                      setPage(0);
                      setPageSize(size);
                    }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078] disabled:opacity-40"
                    disabled={safePage === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                    type="button"
                  >
                    {t("pagination.prev")}
                  </button>
                  <span className="min-w-[3.5rem] text-center text-[11px] font-semibold tabular-nums text-[#516078]">
                    {safePage + 1}/{pageCount}
                  </span>
                  <button
                    className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078] disabled:opacity-40"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                    type="button"
                  >
                    {t("pagination.next")}
                  </button>
                </div>
              </footer>
          </section>

          {canReconcile ? (
          <div className="min-h-0 w-full min-w-0 xl:h-full xl:w-[320px] xl:shrink-0 xl:overflow-hidden 2xl:w-[300px]">
            <PaymentRail
              canReconcile={canReconcile}
              invoices={invoices}
              payments={payments}
              queue={queue}
              viewAllRef={viewAllRef}
              onMatch={(id) => openMatch(id)}
              onReview={(id) => {
                setFormError(null);
                setReviewId(id);
              }}
              onViewAll={() => setQueueOpen(true)}
            />
          </div>
          ) : null}
        </div>
      </div>

      <FormSheet
        closeLabel={t("close")}
        contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
        open={selectedPayment !== null}
        showHeader={false}
        title={selectedPayment?.reference ?? t("title")}
        widthClassName="sm:max-w-[520px]"
        zIndexClassName="z-[60]"
        onClose={() => setSelectedId(null)}
      >
        {selectedPayment ? (
          <PaymentDetailsPanel
            activities={selectedActivities}
            bankTransaction={selectedBank}
            invoice={selectedInvoice}
            ledgerPayments={payments}
            payment={selectedPayment}
            onClose={() => setSelectedId(null)}
            onOpenInvoice={
              canOpenInvoice
                ? () => {
                    if (!selectedInvoice) return;
                    setSelectedId(null);
                    router.push(`/factures?invoice=${selectedInvoice.id}`);
                  }
                : undefined
            }
          />
        ) : null}
      </FormSheet>

      <RecordPaymentSheet
        error={formError}
        invoices={eligible}
        key={recordOpen ? `record-${recordInvoiceId ?? "new"}` : "record-closed"}
        open={recordOpen}
        payments={paymentsAll}
        prefillInvoiceId={recordInvoiceId}
        saving={saving}
        onClose={() => {
          setRecordOpen(false);
          setRecordInvoiceId(null);
          setFormError(null);
        }}
        onSave={(input) => {
          runSave(() => {
            const result = recordPayment(input);
            return result.ok ? { ok: true } : { ok: false, error: result.error };
          });
        }}
      />

      <CollectionFollowUpSheet
        invoice={followUpInvoice}
        key={followUpInvoiceId ?? "follow-up-closed"}
        open={followUpInvoiceId !== null}
        payments={paymentsAll}
        reminderEvents={reminderEvents}
        onClose={() => setFollowUpInvoiceId(null)}
        onSent={() => {
          setNotice(t("followUp.sentNotice"));
          setFollowUpInvoiceId(null);
        }}
      />

      <ReconciliationQueueSheet
        activities={activitiesAll}
        canReconcile={canReconcile}
        invoices={invoices}
        open={queueOpen && canReconcile}
        payments={paymentsAll}
        transactions={queue}
        onClose={() => {
          setQueueOpen(false);
          window.requestAnimationFrame(() => viewAllRef.current?.focus());
        }}
        onMatch={(id) => openMatch(id)}
        onMatchInvoice={(transactionId, invoiceId) => openMatch(transactionId, invoiceId)}
        onReview={(id) => {
          setFormError(null);
          setReviewId(id);
        }}
        onViewPayment={(paymentId) => {
          setQueueOpen(false);
          openPayment(paymentId);
        }}
      />

      <ReviewMatchSheet
        error={formError}
        invoices={eligible}
        key={reviewId ?? "review-closed"}
        open={reviewId !== null}
        payments={paymentsAll}
        saving={saving}
        transaction={reviewTx}
        onClose={() => {
          setReviewId(null);
          setFormError(null);
        }}
        onConfirm={(invoiceId) => {
          if (!reviewId) return;
          runSave(() => {
            const result = matchBankTransaction(reviewId, invoiceId, { manualReview: true });
            return result.ok ? { ok: true } : { ok: false, error: result.error };
          });
        }}
      />

      <ConfirmDialog
        body={
          matchTx
            ? t("match.body", {
                amount: formatMoneyFromCents(matchTx.amountCents),
                invoice: matchInvoice ? invoiceDisplayNumber(matchInvoice) : "—",
                remaining: matchInvoice
                  ? formatMoneyFromCents(remainingCentsFor(matchInvoice, paymentsAll))
                  : "—",
              })
            : undefined
        }
        cancelLabel={t("match.cancel")}
        confirmLabel={t("match.confirm")}
        confirming={saving && matchId !== null}
        open={matchId !== null && matchInvoice !== undefined}
        title={t("match.title")}
        onCancel={() => {
          setMatchId(null);
          setMatchInvoiceId(null);
          setFormError(null);
        }}
        onConfirm={() => {
          if (!matchTx || !matchInvoiceId || saving) return;
          const transactionId = matchTx.id;
          const invoiceId = matchInvoiceId;
          const manualReview = invoiceId !== matchTx.suggestedInvoiceId;
          setSaving(true);
          window.setTimeout(() => {
            const result = matchBankTransaction(transactionId, invoiceId, {
              manualReview,
            });
            setSaving(false);
            setMatchId(null);
            setMatchInvoiceId(null);
            if (!result.ok) {
              if (
                result.error === "overpayment" ||
                result.error === "not_eligible"
              ) {
                clearBankMatchSuggestion(transactionId);
              }
              setFormError(mutationMessage(result.error ?? "failed"));
              setNotice("");
              return;
            }
            setFormError(null);
            setNotice(t("notices.recorded"));
          }, 280);
        }}
      />

      {notice ? (
        <SoftToast message={notice} tone="success" onDismiss={() => setNotice("")} />
      ) : null}
      {formError ? (
        <SoftToast
          message={formError}
          tone="error"
          onDismiss={() => setFormError(null)}
        />
      ) : null}
    </main>
  );
}
