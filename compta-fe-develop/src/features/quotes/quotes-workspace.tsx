"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/compte/confirm-dialog";
import { PageSizeSelect } from "@/components/compte/page-size-select";
import { SoftToast } from "@/components/compte/soft-toast";
import { can } from "@/features/settings/can";
import { usePermissions } from "@/features/settings/session-provider";
import { useRouter } from "@/i18n/navigation";
import { centsToCsvEuro, downloadCsv, mockExportFilename } from "@/lib/csv-export";
import { formatMoneyFromCents } from "@/lib/money";

import { QuoteAnalytics } from "./components/quote-analytics";
import { QuoteDetailsSheet } from "./components/quote-details-sheet";
import { QuoteKpisStrip } from "./components/quote-kpis";
import { QuoteMobileList } from "./components/quote-mobile-list";
import { quoteCaps, type QuoteMenuAction } from "./components/quote-row-menu";
import {
  QuoteToolbar,
  type QuoteSortPreset,
} from "./components/quote-toolbar";
import type { StatusFilterValue } from "./components/quote-status-pills";
import { QuoteTable } from "./components/quote-table";
import { getQuoteKpis } from "./kpis";
import {
  emptyFilters,
  nextActionFor,
  quoteTotals,
  type QuoteFilters,
  type QuoteRecord,
  type QuoteSort,
} from "./model";
import { QuoteCreateDialog } from "./quote-create-dialog";
import { matchesFilters, sortQuotes } from "./query";
import { createInvoiceFromQuote } from "@/features/invoices/store";

import { owners } from "./seed";
import {
  ensureCustomer,
  hydrateLedger,
  insertQuote,
  removeQuote,
  updateQuote,
  useLedger,
} from "./store";

const pageSizeOptions = [5, 10, 25, 50] as const;

function sortFromPreset(preset: QuoteSortPreset): QuoteSort {
  switch (preset) {
    case "oldest":
      return { key: "id", direction: "asc" };
    case "highest":
      return { key: "total", direction: "desc" };
    case "lowest":
      return { key: "total", direction: "asc" };
    case "expiry":
      return { key: "validUntil", direction: "asc" };
    case "newest":
    default:
      return { key: "id", direction: "desc" };
  }
}

export function QuotesWorkspace() {
  const t = useTranslations("register");
  const router = useRouter();
  const params = useSearchParams();
  const ledger = useLedger();
  const quotes = ledger.quotes;
  const customers = ledger.customers;
  const [filters, setFilters] = useState<QuoteFilters>(() => {
    const customerId = params.get("customer");
    const creating = params.get("create") === "1";
    // Opening create with ?customer= should prefill the sheet only — not filter the register empty.
    if (!creating && customerId && customerId !== "new") {
      return { ...emptyFilters, customerId };
    }
    return emptyFilters;
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [sortPreset, setSortPreset] = useState<QuoteSortPreset>("newest");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(params.get("create") === "1");
  const [createCustomerId, setCreateCustomerId] = useState<string | null>(
    params.get("create") === "1" && params.get("customer") && params.get("customer") !== "new"
      ? params.get("customer")
      : null,
  );
  const [detailsId, setDetailsId] = useState<string | null>(
    params.get("quote") && params.get("create") !== "1" ? params.get("quote") : null,
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    hydrateLedger();
  }, []);

  const activePermissions = usePermissions();
  const caps = quoteCaps(activePermissions);
  const { canSend, canApprove, canUpdate, canCreate, canConvert, canRequestInvoice } = caps;
  const canExport = can(activePermissions, "quote.read");

  const requestKey = `${params.get("create") ?? ""}|${params.get("customer") ?? ""}|${params.get("name") ?? ""}`;
  const [appliedRequest, setAppliedRequest] = useState(requestKey);

  if (requestKey !== appliedRequest) {
    setAppliedRequest(requestKey);
    const creating = params.get("create") === "1";
    const customerId = params.get("customer");
    const customerName = params.get("name");
    if (creating) {
      setCreateOpen(true);
      // Deep-link create must not leave the register filtered to that customer (empty list).
      setFilters((current) =>
        current.customerId ? { ...current, customerId: null as string | null } : current,
      );
      if (customerId && customerId !== "new") {
        ensureCustomer({ id: customerId, name: customerName || customerId });
        setCreateCustomerId(customerId);
      } else {
        setCreateCustomerId(null);
      }
    } else if (customerId && customerId !== "new") {
      ensureCustomer({ id: customerId, name: customerName || customerId });
      setFilters((current) => ({ ...current, customerId: customerId ?? null }));
    }
  }

  const effectiveFilters = useMemo<QuoteFilters>(
    () => ({
      ...filters,
      statuses: statusFilter === "all" ? [] : [statusFilter],
    }),
    [filters, statusFilter],
  );

  const sort = useMemo(() => sortFromPreset(sortPreset), [sortPreset]);

  const filtered = useMemo(() => {
    const matched = quotes.filter((quote) => matchesFilters(quote, effectiveFilters, customers));
    return sortQuotes(matched, sort, customers);
  }, [quotes, effectiveFilters, customers, sort]);

  const kpis = useMemo(() => getQuoteKpis(quotes), [quotes]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const filteredTotal = filtered.reduce((sum, quote) => sum + quoteTotals(quote).ttcCents, 0);
  const rangeFrom = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeTo = Math.min(filtered.length, (safePage + 1) * pageSize);

  function patchQuote(id: string, patch: Partial<QuoteRecord>) {
    updateQuote(id, patch);
  }

  function handleNextAction(id: string) {
    const quote = quotes.find((item) => item.id === id);
    if (!quote) return;
    const next = nextActionFor(quote);
    if (next.kind === "send" && canSend) {
      patchQuote(id, {
        status: "sent",
        activity: [
          {
            id: `${id}-sent-${Date.now()}`,
            at: "2026-10-02",
            messageKey: "activity.quoteSent",
            values: { id },
          },
          ...quote.activity,
        ],
      });
      setNotice(t("notices.sent", { id }));
      return;
    }
    if (next.kind === "approve" && canApprove) {
      patchQuote(id, {
        status: "accepted",
        activity: [
          {
            id: `${id}-accepted-${Date.now()}`,
            at: "2026-10-02",
            messageKey: "activity.quoteAccepted",
            values: { id, customer: customerLabel(quote.customerId) },
          },
          ...quote.activity,
        ],
      });
      setNotice(t("notices.approved", { id }));
      return;
    }
    if (next.kind === "followUp" && canUpdate) {
      setNotice(t("notices.followUp", { id }));
      return;
    }
    if (next.kind === "convert" && !canConvert && canRequestInvoice) {
      if (quote.status !== "accepted") return;
      setNotice(t("notices.requestInvoice", { id }));
      return;
    }
    if (next.kind === "convert" && canConvert) {
      if (quote.status !== "accepted") return;
      const invoice = createInvoiceFromQuote(quote, customerLabel(quote.customerId));
      if (!invoice) {
        setNotice(t("notices.convertBlocked"));
        return;
      }
      router.push(`/factures?invoice=${invoice.id}`);
      return;
    }
  }

  function customerLabel(customerId: string) {
    return customers.find((item) => item.id === customerId)?.name ?? customerId;
  }

  function openDetails(id: string) {
    setDetailsId(id);
  }

  const detailsQuote = detailsId
    ? (quotes.find((quote) => quote.id === detailsId) ?? null)
    : null;

  function handleMenuAction(id: string, action: QuoteMenuAction) {
    if (action === "delete") {
      setDeleteId(id);
      return;
    }
    if (action === "open" || action === "history") {
      openDetails(id);
      return;
    }
    if (action === "duplicate") {
      const source = quotes.find((quote) => quote.id === id);
      if (!source) return;
      const numeric = quotes.reduce((max, quote) => {
        const value = Number(quote.id.replace(/\D/g, ""));
        return Number.isFinite(value) ? Math.max(max, value) : max;
      }, 20260100);
      const nextId = `DEV${numeric + 1}`;
      const clone: QuoteRecord = {
        ...source,
        id: nextId,
        status: "draft",
        createdAt: "2026-10-02",
        lines: source.lines.map((line, index) => ({ ...line, id: `${nextId}-l${index}` })),
        activity: [
          {
            id: `${nextId}-created`,
            at: "2026-10-02",
            messageKey: "activity.quoteCreated",
            values: { id: nextId, name: owners.find((o) => o.id === source.ownerId)?.name ?? "" },
          },
        ],
      };
      insertQuote(clone);
      setNotice(t("notices.duplicated", { id: nextId }));
      return;
    }
    if (
      action === "send" ||
      action === "approve" ||
      action === "followUp" ||
      action === "convert" ||
      action === "requestInvoice"
    ) {
      handleNextAction(id);
      return;
    }
    setNotice(t(`notices.${action}`, { id }));
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    removeQuote(id);
    setSelectedIds((current) => current.filter((item) => item !== id));
    if (detailsId === id) setDetailsId(null);
    setDeleteId(null);
    setNotice(t("notices.deleted", { id }));
  }

  function exportQuotesCsv(scope: "filtered" | "selected" = "filtered") {
    const source =
      scope === "selected" && selectedIds.length > 0
        ? quotes.filter((quote) => selectedIds.includes(quote.id))
        : filtered;
    const headers = [
      "id",
      "customer",
      "status",
      "owner_id",
      "valid_until",
      "total_eur",
      "created_at",
      "data_source",
    ];
    const rows = source.map((quote) => [
      quote.id,
      customerLabel(quote.customerId),
      quote.status,
      quote.ownerId,
      quote.validUntil,
      centsToCsvEuro(quoteTotals(quote).ttcCents),
      quote.createdAt,
      "mock",
    ]);
    const { rowCount } = downloadCsv(mockExportFilename("quotes"), headers, rows);
    setNotice(t("notices.exported", { count: rowCount }));
  }

  function exportSelected() {
    exportQuotesCsv(selectedIds.length > 0 ? "selected" : "filtered");
  }

  const hasActiveFilters =
    effectiveFilters.query.trim().length > 0 ||
    effectiveFilters.statuses.length > 0 ||
    Boolean(effectiveFilters.ownerId) ||
    Boolean(effectiveFilters.customerId) ||
    effectiveFilters.datePreset !== "any";

  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="app-scroll dashboard-page flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto lg:min-h-0 lg:overflow-hidden">
        <div className="dashboard-enter enter-0 min-w-0 shrink-0 overflow-visible">
          <QuoteKpisStrip kpis={kpis} />
        </div>

        <div className="dashboard-enter enter-1 flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:overflow-hidden">
          <section className="dashboard-card dashboard-list flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden sm:min-h-[320px]">
            <QuoteToolbar
              canCreate={canCreate}
              customers={customers}
              filters={filters}
              onClearFilters={() => {
                setFilters(emptyFilters);
                setStatusFilter("all");
                setPage(0);
              }}
              onCreate={() => {
                setCreateCustomerId(null);
                setCreateOpen(true);
              }}
              onExport={canExport ? () => exportQuotesCsv("filtered") : undefined}
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

            {canExport && selectedIds.length > 0 ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#edf2f8] px-3.5 py-2">
                <span className="text-xs font-medium text-[#516078]">
                  {t("selected", { count: selectedIds.length })}
                </span>
                <button
                  className="action-motion soft-button inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-xs font-semibold text-[#405069]"
                  onClick={exportSelected}
                  type="button"
                >
                  <Download aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("export")}
                </button>
                <button
                  className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-xs font-semibold text-[#516078]"
                  onClick={() => setSelectedIds([])}
                  type="button"
                >
                  {t("cancel")}
                </button>
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <p className="text-sm font-semibold text-[#24334c]">
                  {hasActiveFilters ? t("empty.filteredTitle") : t("empty.title")}
                </p>
                <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">
                  {hasActiveFilters ? t("empty.filteredBody") : t("empty.body")}
                </p>
                {hasActiveFilters ? (
                  <button
                    className="action-motion soft-button mt-2 h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
                    onClick={() => {
                      setFilters(emptyFilters);
                      setStatusFilter("all");
                    }}
                    type="button"
                  >
                    {t("empty.clear")}
                  </button>
                ) : canCreate ? (
                  <button
                    className="action-motion soft-primary mt-2 h-9 rounded-[9px] px-3 text-xs font-semibold text-white"
                    onClick={() => setCreateOpen(true)}
                    type="button"
                  >
                    {t("empty.create")}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="hidden min-h-0 flex-1 flex-col lg:flex">
                  <QuoteTable
                    canSelect={canExport}
                    caps={caps}
                    customers={customers}
                    onMenuAction={handleMenuAction}
                    onNextAction={handleNextAction}
                    onOpen={openDetails}
                    onToggleAll={() => {
                      setSelectedIds((current) =>
                        current.length === visible.length ? [] : visible.map((quote) => quote.id),
                      );
                    }}
                    onToggleCheck={(id) => {
                      setSelectedIds((current) =>
                        current.includes(id)
                          ? current.filter((item) => item !== id)
                          : [...current, id],
                      );
                    }}
                    quotes={visible}
                    selectedIds={selectedIds}
                  />
                </div>
                <QuoteMobileList
                  caps={caps}
                  customers={customers}
                  onMenuAction={handleMenuAction}
                  onNextAction={handleNextAction}
                  onOpen={openDetails}
                  quotes={visible}
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

          <div className="app-scroll shrink-0 xl:h-full xl:overflow-y-auto">
            <QuoteAnalytics quotes={quotes} />
          </div>
        </div>
      </div>

      <QuoteDetailsSheet
        caps={caps}
        customers={customers}
        open={Boolean(detailsId)}
        quote={detailsQuote}
        onClose={() => setDetailsId(null)}
        onNextAction={handleNextAction}
      />

      <ConfirmDialog
        body={t("deleteConfirm.body")}
        cancelLabel={t("deleteConfirm.cancel")}
        confirmLabel={t("deleteConfirm.confirm")}
        danger
        open={deleteId !== null}
        title={t("deleteConfirm.title")}
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      {createOpen && canCreate ? (
        <QuoteCreateDialog
          customers={customers}
          forceNewCustomer={params.get("customer") === "new"}
          initialCustomerId={createCustomerId}
          onClose={() => {
            setCreateOpen(false);
            setCreateCustomerId(null);
            if (params.get("create") === "1") router.replace("/devis");
          }}
          onCreated={(quote, customer) => {
            ensureCustomer({ id: customer.id, name: customer.name });
            setDetailsId(quote.id);
          }}
        />
      ) : null}

      {notice ? (
        <SoftToast message={notice} tone="success" onDismiss={() => setNotice("")} />
      ) : null}
    </main>
  );
}
