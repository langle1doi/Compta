"use client";

import { ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/compte/confirm-dialog";
import { PageSizeSelect } from "@/components/compte/page-size-select";
import { SoftToast } from "@/components/compte/soft-toast";
import { FormSheet } from "@/components/forms/form-sheet";
import { CollectionFollowUpSheet } from "@/features/payments/components/collection-follow-up-sheet";
import { useReminderEvents } from "@/features/payments/reminders";
import { can } from "@/features/settings/can";
import { usePermissions } from "@/features/settings/session-provider";
import { useRouter } from "@/i18n/navigation";
import { centsToCsvEuro, downloadCsv, mockExportFilename } from "@/lib/csv-export";
import { formatMoneyFromCents } from "@/lib/money";

import { InvoiceDetailsPanel } from "./components/invoice-details-panel";
import { InvoiceKpisStrip } from "./components/invoice-kpis";
import { InvoiceMobileList } from "./components/invoice-mobile-list";
import { allowedInvoiceAction, type InvoiceMenuAction } from "./components/invoice-row-menu";
import { InvoiceTable } from "./components/invoice-table";
import { InvoiceToolbar } from "./components/invoice-toolbar";
import { SelectQuoteSheet } from "./components/select-quote-sheet";
import { getInvoiceKpis } from "./kpis";
import { ledgerToday } from "@/features/quotes/model";
import {
  emptyInvoiceFilters,
  invoiceDisplayNumber,
  invoiceListStatus,
  invoiceTotals,
  isInvoiceLocked,
  nextInvoiceAction,
  paidCentsFor,
  remainingCentsFor,
  type InvoiceDraftPatch,
  type InvoiceFilters,
  type InvoiceListStatusFilter,
  type InvoiceSortPreset,
} from "./model";
import { existingDraftForQuote, isQuoteConvertible, matchesInvoiceFilters, sortInvoices } from "./query";
import {
  createInvoiceFromQuote,
  deleteInvoice,
  markInvoiceSent,
  updateInvoice,
  useInvoicePayments,
  useInvoices,
  validateInvoice,
} from "./store";
import { hydrateLedger, useLedger } from "@/features/quotes/store";
import { owners } from "@/features/quotes/seed";

const pageSizeOptions = [5, 10, 25, 50] as const;

export function InvoicesWorkspace() {
  const t = useTranslations("invoices");
  const router = useRouter();
  const params = useSearchParams();
  const invoices = useInvoices();
  const payments = useInvoicePayments();
  const reminderEvents = useReminderEvents();
  const ledger = useLedger();
  const [filters, setFilters] = useState<InvoiceFilters>(emptyInvoiceFilters);
  const [statusFilter, setStatusFilter] = useState<InvoiceListStatusFilter>("all");
  const [sortPreset, setSortPreset] = useState<InvoiceSortPreset>("newest");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("invoice"));
  const [createOpen, setCreateOpen] = useState(params.get("create") === "1");
  const [followUpInvoiceId, setFollowUpInvoiceId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [validateId, setValidateId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"details" | "items" | "payments" | "activity">("details");

  useEffect(() => {
    hydrateLedger();
  }, []);

  const activePermissions = usePermissions();
  const canCreate = can(activePermissions, "invoice.create");
  const canValidate = can(activePermissions, "invoice.validate");
  const canRead = can(activePermissions, "invoice.read");
  const canExport = can(activePermissions, "invoice.read");
  // No dedicated backend code: sending belongs to whoever prepares or validates invoices.
  const canSendInvoice = can(activePermissions, "invoice.read");
  // Payment reminders belong to whoever handles collections.
  const canFollowUp =
    can(activePermissions, "payment.create") || can(activePermissions, "payment.manage");

  const requestKey = `${params.get("invoice") ?? ""}|${params.get("create") ?? ""}`;
  const [appliedRequest, setAppliedRequest] = useState(requestKey);
  if (requestKey !== appliedRequest) {
    setAppliedRequest(requestKey);
    const invoiceId = params.get("invoice");
    setSelectedId(invoiceId);
    setCreateOpen(params.get("create") === "1");
  }

  const effectiveFilters = useMemo<InvoiceFilters>(
    () => ({ ...filters, status: statusFilter }),
    [filters, statusFilter],
  );

  const filtered = useMemo(() => {
    const matched = invoices.filter((invoice) =>
      matchesInvoiceFilters(invoice, effectiveFilters, payments),
    );
    return sortInvoices(matched, sortPreset, payments);
  }, [invoices, effectiveFilters, payments, sortPreset]);

  const kpis = useMemo(() => getInvoiceKpis(invoices, payments), [invoices, payments]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const filteredTotal = filtered.reduce((sum, invoice) => sum + invoiceTotals(invoice).ttcCents, 0);
  const rangeFrom = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeTo = Math.min(filtered.length, (safePage + 1) * pageSize);
  const selectedInvoice = selectedId
    ? (invoices.find((invoice) => invoice.id === selectedId) ?? null)
    : null;
  const selectedPayments = selectedInvoice
    ? payments.filter((payment) => payment.invoiceId === selectedInvoice.id)
    : [];
  const followUpInvoice = followUpInvoiceId
    ? (invoices.find((invoice) => invoice.id === followUpInvoiceId) ?? null)
    : null;

  function exportInvoicesCsv() {
    const headers = [
      "number",
      "customer",
      "status",
      "issue_date",
      "due_date",
      "total_eur",
      "paid_eur",
      "remaining_eur",
      "owner_id",
      "quote_id",
      "data_source",
    ];
    const rows = filtered.map((invoice) => {
      const totals = invoiceTotals(invoice);
      return [
        invoiceDisplayNumber(invoice),
        invoice.customerName,
        invoiceListStatus(invoice, payments, ledgerToday),
        invoice.issueDate,
        invoice.dueDate,
        centsToCsvEuro(totals.ttcCents),
        centsToCsvEuro(paidCentsFor(invoice.id, payments)),
        centsToCsvEuro(remainingCentsFor(invoice, payments)),
        invoice.ownerId,
        invoice.quoteId ?? "",
        "mock",
      ];
    });
    const { rowCount } = downloadCsv(mockExportFilename("invoices"), headers, rows);
    setNotice(t("exportDone", { count: rowCount }));
  }

  const eligibleQuotes = useMemo(
    () =>
      ledger.quotes
        .filter((quote) => isQuoteConvertible(quote, invoices) || existingDraftForQuote(quote.id, invoices))
        .filter((quote) => quote.status === "accepted")
        .map((quote) => ({
          ...quote,
          customerName:
            ledger.customers.find((customer) => customer.id === quote.customerId)?.name ??
            quote.customerId,
        })),
    [ledger.quotes, ledger.customers, invoices],
  );

  const hasActiveFilters =
    effectiveFilters.query.trim().length > 0 ||
    effectiveFilters.status !== "all" ||
    Boolean(effectiveFilters.ownerId) ||
    Boolean(effectiveFilters.customerId) ||
    effectiveFilters.datePreset !== "any";

  function openInvoice(id: string, tab: typeof panelTab = "details") {
    setPanelTab(tab);
    setSelectedId(id);
    setDirty(false);
    router.replace(`/factures?invoice=${id}`);
  }

  function requestClose() {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    closePanel();
  }

  function closePanel() {
    setSelectedId(null);
    setDirty(false);
    setDiscardOpen(false);
    router.replace("/factures");
  }

  function handleNextAction(id: string) {
    const invoice = invoices.find((item) => item.id === id);
    if (!invoice) return;
    const next = allowedInvoiceAction(nextInvoiceAction(invoice, payments, ledgerToday), {
      canUpdate: canCreate,
      canValidate,
      canFollowUp,
    });
    if (next === "validate") {
      openInvoice(id);
      setValidateId(id);
      return;
    }
    if (next === "followUp") {
      setFollowUpInvoiceId(id);
      return;
    }
    openInvoice(id, next === "edit" ? "details" : "details");
  }

  function handleMenuAction(id: string, action: InvoiceMenuAction) {
    if (action === "delete") {
      setDeleteId(id);
      return;
    }
    if (action === "send") {
      const ok = markInvoiceSent(id);
      setNotice(ok ? t("notices.sent") : t("locked"));
      return;
    }
    if (action === "history") {
      openInvoice(id, "activity");
      return;
    }
    openInvoice(id);
  }

  function handleCreateFromQuote(quoteId: string) {
    const quote = ledger.quotes.find((item) => item.id === quoteId);
    if (!quote || !canCreate) return;
    const customerName =
      ledger.customers.find((customer) => customer.id === quote.customerId)?.name ?? quote.customerId;
    const invoice = createInvoiceFromQuote(quote, customerName);
    setCreateOpen(false);
    if (!invoice) {
      setNotice(t("notices.convertBlocked"));
      return;
    }
    setNotice(t("notices.created"));
    openInvoice(invoice.id);
  }

  function handleSave(patch: InvoiceDraftPatch) {
    if (!selectedInvoice) return;
    const ok = updateInvoice(selectedInvoice.id, patch);
    setNotice(ok ? t("notices.saved") : t("locked"));
    setDirty(false);
  }

  function confirmValidate() {
    if (!validateId) return;
    const ok = validateInvoice(validateId);
    setValidateId(null);
    setNotice(ok ? t("validated") : t("locked"));
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    const ok = deleteInvoice(id);
    setDeleteId(null);
    if (selectedId === id) closePanel();
    setSelectedIds((current) => current.filter((item) => item !== id));
    setNotice(ok ? t("deleted") : t("locked"));
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
      <div className="app-scroll dashboard-page flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto lg:min-h-0 lg:overflow-hidden">
        <div className="dashboard-enter enter-0 min-w-0 shrink-0 overflow-visible">
          <InvoiceKpisStrip kpis={kpis} />
        </div>

        <section className="dashboard-card dashboard-list flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden sm:min-h-[320px]">
          <InvoiceToolbar
            canCreate={canCreate}
            customers={ledger.customers}
            filters={filters}
            onClearFilters={() => {
              setFilters(emptyInvoiceFilters);
              setStatusFilter("all");
              setPage(0);
            }}
            onCreate={() => setCreateOpen(true)}
            onExport={canExport ? exportInvoicesCsv : undefined}
            onFiltersChange={(patch) => {
              setPage(0);
              setFilters((current) => ({ ...current, ...patch }));
            }}
            onQueryChange={(value) => {
              setPage(0);
              setFilters((current) => ({ ...current, query: value }));
            }}
            onSortChange={(value) => {
              setPage(0);
              setSortPreset(value);
            }}
            onStatusChange={(value) => {
              setPage(0);
              setStatusFilter(value);
            }}
            owners={owners}
            query={filters.query}
            sortPreset={sortPreset}
            status={statusFilter}
          />

          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <ReceiptText aria-hidden="true" className="h-8 w-8 text-[#b7c3d6]" />
              <p className="text-sm font-semibold text-[#24334c]">
                {hasActiveFilters ? t("emptyFilteredTitle") : t("emptyTitle")}
              </p>
              <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">
                {hasActiveFilters ? t("emptyFilteredBody") : t("emptyBody")}
              </p>
              {hasActiveFilters ? (
                <button
                  className="action-motion soft-button mt-2 h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
                  onClick={() => {
                    setFilters(emptyInvoiceFilters);
                    setStatusFilter("all");
                  }}
                  type="button"
                >
                  {t("emptyClear")}
                </button>
              ) : canCreate ? (
                <button
                  className="action-motion soft-primary mt-2 h-9 rounded-[9px] px-3 text-xs font-semibold text-white"
                  onClick={() => setCreateOpen(true)}
                  type="button"
                >
                  {t("emptyCreate")}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="hidden min-h-0 flex-1 flex-col lg:flex">
                <InvoiceTable
                  canFollowUp={canFollowUp}
                  canSend={canSendInvoice}
                  canUpdate={canCreate}
                  canValidate={canValidate}
                  invoices={visible}
                  onMenuAction={handleMenuAction}
                  onNextAction={handleNextAction}
                  onOpen={openInvoice}
                  onToggleAll={() => {
                    setSelectedIds((current) =>
                      current.length === visible.length ? [] : visible.map((invoice) => invoice.id),
                    );
                  }}
                  onToggleCheck={(id) => {
                    setSelectedIds((current) =>
                      current.includes(id)
                        ? current.filter((item) => item !== id)
                        : [...current, id],
                    );
                  }}
                  payments={payments}
                  selectedId={selectedId}
                  selectedIds={selectedIds}
                />
              </div>
              <InvoiceMobileList
                canFollowUp={canFollowUp}
                canSend={canSendInvoice}
                canUpdate={canCreate}
                canValidate={canValidate}
                invoices={visible}
                onMenuAction={handleMenuAction}
                onNextAction={handleNextAction}
                onOpen={openInvoice}
                payments={payments}
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
      </div>

      <FormSheet
        closeLabel={t("close")}
        contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
        open={selectedInvoice !== null}
        showHeader={false}
        title={selectedInvoice?.customerName ?? t("workspaceTitle")}
        widthClassName="sm:max-w-[520px]"
        zIndexClassName="z-[60]"
        onClose={requestClose}
      >
        {selectedInvoice ? (
          <InvoiceDetailsPanel
            canSend={canSendInvoice}
            canUpdate={canCreate}
            canValidate={canValidate && !isInvoiceLocked(selectedInvoice)}
            customers={ledger.customers}
            initialTab={panelTab}
            invoice={selectedInvoice}
            payments={selectedPayments}
            onCancel={() => setDirty(false)}
            onClose={requestClose}
            onDelete={() => setDeleteId(selectedInvoice.id)}
            onDirtyChange={setDirty}
            onSave={handleSave}
            onSend={() => {
              const ok = markInvoiceSent(selectedInvoice.id);
              setNotice(ok ? t("notices.sent") : t("locked"));
            }}
            onValidate={() => setValidateId(selectedInvoice.id)}
          />
        ) : null}
      </FormSheet>

      <SelectQuoteSheet
        open={createOpen && canCreate}
        quotes={eligibleQuotes}
        onClose={() => setCreateOpen(false)}
        onSelect={handleCreateFromQuote}
      />

      <CollectionFollowUpSheet
        invoice={followUpInvoice}
        key={followUpInvoiceId ?? "follow-up-closed"}
        open={followUpInvoiceId !== null}
        payments={payments}
        reminderEvents={reminderEvents}
        onClose={() => setFollowUpInvoiceId(null)}
        onSent={() => {
          setNotice(t("notices.followUpSent"));
          setFollowUpInvoiceId(null);
        }}
      />

      <ConfirmDialog
        body={t("validateConfirm")}
        cancelLabel={t("cancel")}
        confirmLabel={t("validate")}
        open={validateId !== null}
        title={t("validateTitle")}
        onCancel={() => setValidateId(null)}
        onConfirm={confirmValidate}
      />

      <ConfirmDialog
        body={t("deleteConfirm.body")}
        cancelLabel={t("cancel")}
        confirmLabel={t("delete")}
        danger
        open={deleteId !== null}
        title={t("deleteConfirm.title")}
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        body={t("discard.body")}
        cancelLabel={t("discard.keep")}
        confirmLabel={t("discard.leave")}
        danger
        open={discardOpen}
        title={t("discard.title")}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={closePanel}
      />

      {notice ? (
        <SoftToast message={notice} tone="success" onDismiss={() => setNotice("")} />
      ) : null}
    </main>
  );
}
