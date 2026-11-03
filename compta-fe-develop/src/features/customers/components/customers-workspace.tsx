"use client";

import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiErrorState } from "@/components/compte/api-error-state";
import { ConfirmDialog } from "@/components/compte/confirm-dialog";
import { ExportCsvButton } from "@/components/compte/export-csv-button";
import { PageSizeSelect } from "@/components/compte/page-size-select";
import { SoftToast } from "@/components/compte/soft-toast";
import { FormSheet } from "@/components/forms/form-sheet";
import { Can, useCan } from "@/features/settings/can";
import { useSession } from "@/features/settings/session-provider";
import { downloadCsv, exportFilename } from "@/lib/csv-export";
import { cn } from "@/lib/utils";

import {
  detectDuplicatesIn,
  getCustomerKpisFrom,
  listCustomersFrom,
  useCustomerDetail,
  useCustomerOwners,
  useCustomers,
} from "../services/customers-service";
import { uniqueCountries, uniqueTags } from "../query";
import {
  emptyCustomerFilters,
  type CustomerFilters,
  type CustomerRecord,
} from "../types";
import { CustomerDetailsPanel } from "./customer-details-panel";
import { CustomerFormDialog } from "./customer-form-dialog";
import { CustomerKpisStrip } from "./customer-kpis";
import { CustomerMobileList } from "./customer-mobile-list";
import { CustomerTable } from "./customer-table";
import { CustomerToolbar } from "./customer-toolbar";
import { DuplicateCustomerDialog } from "./duplicate-customer-dialog";

export function CustomersWorkspace() {
  const t = useTranslations("customers");
  const router = useRouter();
  const params = useSearchParams();
  const check = useCan();
  const { user } = useSession();
  const { customers, isLoading, error: loadError } = useCustomers();
  const owners = useCustomerOwners(customers);

  const [filters, setFilters] = useState<CustomerFilters>(() => ({
    ...emptyCustomerFilters,
    search: params.get("search") ?? "",
    type: (params.get("type") as CustomerFilters["type"]) || "all",
    ownerId: params.get("owner") ?? "all",
    tag: params.get("tag") ?? "all",
    country: params.get("country") ?? "all",
    status: (params.get("status") as CustomerFilters["status"]) || "all",
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [pendingResume, setPendingResume] = useState<(() => void) | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<CustomerRecord[]>([]);
  const [detailGuard, setDetailGuard] = useState({ editing: false, dirty: false });
  const [discardCloseOpen, setDiscardCloseOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const filteredCustomers = useMemo(
    () => listCustomersFrom(customers, filters),
    [customers, filters],
  );

  const kpis = useMemo(
    () => getCustomerKpisFrom(customers, filters),
    [customers, filters],
  );

  const countries = useMemo(() => uniqueCountries(customers), [customers]);
  const tags = useMemo(() => uniqueTags(customers), [customers]);

  // The list has no contacts or addresses: editing waits for the detail response.
  const detail = useCustomerDetail(detailOpen ? selectedId : null);
  const selected: CustomerRecord | null =
    detail.data ?? customers.find((customer) => customer.id === selectedId) ?? null;
  const owner = owners.find((item) => item.id === selected?.ownerId);

  function exportCustomersCsv() {
    const headers = [
      "id",
      "display_name",
      "type",
      "status",
      "email",
      "phone",
      "siret",
      "vat_number",
      "owner_id",
      "payment_terms",
      "payment_method",
      "tags",
    ];
    const rows = filteredCustomers.map((customer) => {
      return [
        customer.id,
        customer.displayName,
        customer.type,
        customer.status,
        customer.email,
        customer.phone ?? "",
        customer.siret ?? "",
        customer.vatNumber ?? "",
        customer.ownerId,
        customer.paymentTerms,
        customer.paymentMethod,
        customer.tags.join("|"),
      ];
    });
    const { rowCount } = downloadCsv(exportFilename("customers"), headers, rows);
    setNotice(t("exportDone", { count: rowCount }));
  }

  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.search) next.set("search", filters.search);
    if (filters.type !== "all") next.set("type", filters.type);
    if (filters.ownerId !== "all") next.set("owner", filters.ownerId);
    if (filters.tag !== "all") next.set("tag", filters.tag);
    if (filters.country !== "all") next.set("country", filters.country);
    if (filters.status !== "all") next.set("status", filters.status);
    const query = next.toString();
    router.replace(query ? `/customers?${query}` : "/customers");
  }, [filters, router]);

  function selectCustomer(id: string) {
    setFormOpen(false);
    setSelectedId(id);
    setDetailOpen(true);
  }

  function closeDetail() {
    if (detailGuard.editing && detailGuard.dirty) {
      setDiscardCloseOpen(true);
      return;
    }
    setDetailOpen(false);
    setDetailGuard({ editing: false, dirty: false });
  }

  function confirmCloseDetail() {
    setDiscardCloseOpen(false);
    setDetailOpen(false);
    setDetailGuard({ editing: false, dirty: false });
  }

  function openCreate() {
    setDetailOpen(false);
    setDetailGuard({ editing: false, dirty: false });
    setCreateKey((value) => value + 1);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  const pageSizeOptions = [5, 10, 25, 50] as const;
  const pageCount = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pagedCustomers = filteredCustomers.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );
  const searchExpanded = searchFocused || filters.search.trim().length > 0;

  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
      <div className="dashboard-page flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto lg:min-h-0 lg:overflow-hidden">
        <div className="dashboard-enter enter-0 min-w-0 shrink-0 overflow-visible">
          <CustomerKpisStrip kpis={kpis} />
        </div>

        <section className="dashboard-card flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden sm:min-h-[320px]">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-[#edf2f8] px-3.5 py-3">
            <div className="min-w-0">
              <h3 className="dashboard-card-title text-[15px]">{t("list.title")}</h3>
              <p className="mt-0.5 text-[11px] leading-4 text-[#7d8aa0]">{t("list.subtitle")}</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:flex-nowrap">
              <label
                className={cn(
                  "soft-input relative flex h-9 shrink-0 items-center gap-2 overflow-hidden rounded-[9px] px-2.5 transition-[width,max-width] duration-200 ease-out",
                  searchExpanded
                    ? "w-full max-w-none basis-full sm:basis-auto sm:w-[min(100%,18rem)] md:w-[22rem]"
                    : "w-9 cursor-pointer justify-center px-0 sm:w-10",
                )}
                onClick={() => {
                  if (!searchExpanded) searchInputRef.current?.focus();
                }}
              >
                <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#8a97ab]" />
                <input
                  ref={searchInputRef}
                  aria-label={t("filters.searchPlaceholder")}
                  className={cn(
                    "compte-search-input min-w-0 bg-transparent text-xs text-[#24334c] outline-none placeholder:text-[#98a4b5]",
                    searchExpanded ? "flex-1" : "w-0 p-0 opacity-0",
                  )}
                  onBlur={() => setSearchFocused(false)}
                  onChange={(event) => {
                    setPage(0);
                    setFilters((current) => ({ ...current, search: event.target.value }));
                  }}
                  onFocus={() => setSearchFocused(true)}
                  placeholder={t("filters.searchPlaceholder")}
                  type="search"
                  value={filters.search}
                />
              </label>
              <CustomerToolbar
                countries={countries}
                filters={filters}
                onChange={(next) => {
                  setPage(0);
                  setFilters(next);
                }}
                owners={owners}
                tags={tags}
              />
              <Can permission="customer.create">
                <button
                  className="action-motion soft-primary inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(4,76,226,0.22)]"
                  onClick={openCreate}
                  type="button"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                  {t("add")}
                </button>
              </Can>
              <ExportCsvButton
                className="h-8 w-8 rounded-[8px]"
                label={t("export")}
                onClick={exportCustomersCsv}
              />
            </div>
          </div>

          {loadError ? (
            <ApiErrorState error={loadError} />
          ) : isLoading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12 text-center">
              <p className="text-xs text-[#7d8aa0]">{t("list.loading")}</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
              <p className="text-sm font-semibold text-[#24334c]">{t("empty.title")}</p>
              <p className="mt-1 max-w-[36ch] text-xs leading-5 text-[#7d8aa0]">{t("empty.body")}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Can permission="customer.create">
                  <button
                    className="action-motion soft-primary inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(4,76,226,0.22)]"
                    onClick={openCreate}
                    type="button"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                    {t("add")}
                  </button>
                </Can>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 lg:flex">
                <CustomerTable
                  customers={pagedCustomers}
                  onOpen={selectCustomer}
                  onSelect={selectCustomer}
                  onToggleAll={() =>
                    setCheckedIds(
                      checkedIds.length === pagedCustomers.length
                        ? []
                        : pagedCustomers.map((customer) => customer.id),
                    )
                  }
                  onToggleCheck={(id) =>
                    setCheckedIds((current) =>
                      current.includes(id)
                        ? current.filter((item) => item !== id)
                        : [...current, id],
                    )
                  }
                  owners={owners}
                  selectedId={detailOpen ? selectedId : null}
                  selectedIds={checkedIds}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 lg:hidden">
                <CustomerMobileList
                  customers={pagedCustomers}
                  onSelect={selectCustomer}
                  owners={owners}
                  selectedId={detailOpen ? selectedId : null}
                />
              </div>
              <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#edf2f8] px-3.5 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-[11px] text-[#7d8aa0]">
                    {t("pagination.summary", {
                      from: filteredCustomers.length === 0 ? 0 : safePage * pageSize + 1,
                      to: Math.min(filteredCustomers.length, (safePage + 1) * pageSize),
                      total: filteredCustomers.length,
                    })}
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
            </>
          )}
        </section>
      </div>

      <FormSheet
        closeLabel={t("details.close")}
        contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
        open={detailOpen && selected !== null}
        showHeader={false}
        title={selected?.displayName ?? t("title")}
        widthClassName="sm:max-w-[520px]"
        zIndexClassName="z-[60]"
        onClose={closeDetail}
      >
        <CustomerDetailsPanel
          key={selected?.id ?? "none"}
          canUpdate={check("customer.update") && Boolean(detail.data)}
          customer={selected}
          embedded
          owner={owner}
          owners={owners}
          onClose={closeDetail}
          onDuplicateFound={(draft, resume) => {
            const found = detectDuplicatesIn(
              customers,
              {
                displayName: draft.displayName,
                email: draft.email,
                siret: draft.siret,
                vatNumber: draft.vatNumber,
              },
              selectedId ?? undefined,
            );
            if (found.length) {
              setPendingResume(() => resume);
              setDuplicateCandidates(found);
              return;
            }
            resume();
          }}
          onEditingChange={setDetailGuard}
          onDeleted={() => {
            setDetailOpen(false);
            setSelectedId(null);
            setDetailGuard({ editing: false, dirty: false });
            setNotice(t("deleted"));
          }}
          onSaved={() => {
            setNotice(t("updated"));
            setDetailGuard({ editing: false, dirty: false });
          }}
        />
      </FormSheet>

      <CustomerFormDialog
        defaultOwnerId={user?.id ?? ""}
        key={`create-${createKey}-${user?.id ?? ""}`}
        onClose={closeForm}
        onDuplicateFound={(draft, resume) => {
          const found = detectDuplicatesIn(customers, {
            displayName: draft.displayName,
            email: draft.email,
            siret: draft.siret,
            vatNumber: draft.vatNumber,
          });
          if (found.length) {
            setPendingResume(() => resume);
            setDuplicateCandidates(found);
            return;
          }
          resume();
        }}
        onCreated={(created) => {
          setNotice(t("created"));
          setSelectedId(created.id);
          setDetailOpen(true);
          setCheckedIds([]);
          setPage(0);
        }}
        open={formOpen}
        owners={owners}
      />

      <DuplicateCustomerDialog
        candidates={duplicateCandidates}
        onClose={() => {
          setDuplicateCandidates([]);
          setPendingResume(null);
        }}
        onContinue={() => {
          pendingResume?.();
          setDuplicateCandidates([]);
          setPendingResume(null);
        }}
        onReview={(id) => {
          setDuplicateCandidates([]);
          setPendingResume(null);
          closeForm();
          selectCustomer(id);
        }}
        open={duplicateCandidates.length > 0}
      />

      <ConfirmDialog
        body={t("details.discardConfirm")}
        cancelLabel={t("details.keepEditing")}
        confirmLabel={t("details.discardAction")}
        danger
        open={discardCloseOpen}
        title={t("details.discardTitle")}
        onCancel={() => setDiscardCloseOpen(false)}
        onConfirm={confirmCloseDetail}
      />

      {notice ? (
        <SoftToast message={notice} tone="success" onDismiss={() => setNotice("")} />
      ) : null}
    </main>
  );
}
