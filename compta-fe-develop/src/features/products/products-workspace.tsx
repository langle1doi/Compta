"use client";

import { Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { PageSizeSelect } from "@/components/compte/page-size-select";
import { SoftToast } from "@/components/compte/soft-toast";
import { FormSheet } from "@/components/forms/form-sheet";
import { hydrateLedger, useLedger } from "@/features/quotes/store";
import { can } from "@/features/settings/can";
import { useCurrentCompany } from "@/features/settings/company-store";
import { usePermissions } from "@/features/settings/session-provider";
import { centsToCsvEuro, downloadCsv, mockExportFilename } from "@/lib/csv-export";
import { formatMoneyFromCents } from "@/lib/money";

import { ProductDetailsPanel } from "./components/product-details-panel";
import { ProductFormSheet } from "./components/product-form-sheet";
import { ProductKpisStrip } from "./components/product-kpis";
import { ProductMobileList } from "./components/product-mobile-list";
import { ProductTable } from "./components/product-table";
import { ProductToolbar } from "./components/product-toolbar";
import { getProductKpis } from "./kpis";
import {
  emptyProductFilters,
  type ProductFilters,
  type ProductSortPreset,
} from "./model";
import { filterProducts, productsForCompany, usageForProduct } from "./query";
import {
  createProduct,
  removeCustomerPrice,
  updateProduct,
  upsertCustomerPrice,
  useCustomerProductPrices,
  useProductActivities,
  useProducts,
  useProductUsage,
} from "./store";

const pageSizeOptions = [10, 25, 50] as const;

export function ProductsWorkspace() {
  const t = useTranslations("products");
  const { companyId } = useCurrentCompany();
  const productsAll = useProducts();
  const pricesAll = useCustomerProductPrices();
  const activitiesAll = useProductActivities();
  const usageAll = useProductUsage();
  const ledger = useLedger();

  const [filters, setFilters] = useState<ProductFilters>(emptyProductFilters);
  const [sortPreset, setSortPreset] = useState<ProductSortPreset>("nameAsc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"view" | "edit">("view");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    hydrateLedger();
  }, []);

  const activePermissions = usePermissions();
  const canRead = can(activePermissions, "product.read");
  const canCreate = can(activePermissions, "product.create");
  const canUpdate = can(activePermissions, "product.update");
  const canExport = can(activePermissions, "product.read");

  const products = useMemo(
    () => productsForCompany(productsAll, companyId),
    [companyId, productsAll],
  );
  const filtered = useMemo(
    () => filterProducts(products, filters, sortPreset, usageAll),
    [filters, products, sortPreset, usageAll],
  );
  const kpis = useMemo(() => getProductKpis(products, usageAll), [products, usageAll]);
  const filteredCatalogValue = useMemo(
    () => filtered.reduce((sum, item) => sum + item.unitPriceCents, 0),
    [filtered],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeFrom = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeTo = Math.min(filtered.length, (safePage + 1) * pageSize);

  const selected = products.find((item) => item.id === selectedId) ?? null;
  const selectedPrices = pricesAll.filter((item) => item.productId === selected?.id);
  const selectedUsage = selected ? usageForProduct(usageAll, selected.id) : [];
  const selectedActivities = activitiesAll.filter((item) => item.productId === selected?.id);
  const customers = ledger.customers.map((item) => ({
    id: item.id,
    name: item.name,
  }));

  const hasActiveFilters =
    Boolean(filters.query.trim()) ||
    filters.tab !== "all" ||
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.categoryId !== "all";

  function openProduct(id: string, mode: "view" | "edit" = "view") {
    setSelectedId(id);
    setPanelMode(mode);
  }

  function exportProductsCsv() {
    const headers = [
      "sku",
      "name",
      "description",
      "type",
      "category",
      "unit",
      "unit_price_eur",
      "cost_eur",
      "vat_rate",
      "status",
      "data_source",
    ];
    const rows = filtered.map((product) => [
      product.code,
      product.name,
      product.description,
      product.type,
      product.categoryId,
      product.unit,
      centsToCsvEuro(product.unitPriceCents),
      centsToCsvEuro(product.costCents),
      product.vatRate,
      product.status,
      "mock",
    ]);
    const { rowCount } = downloadCsv(mockExportFilename("products"), headers, rows);
    setNotice(t("exportDone", { count: rowCount }));
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
          <ProductKpisStrip kpis={kpis} />
        </div>

        <section className="dashboard-card dashboard-list dashboard-enter enter-1 flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden sm:min-h-[320px]">
          <ProductToolbar
            canCreate={canCreate}
            filters={filters}
            sortPreset={sortPreset}
            onClearFilters={() => {
              setFilters(emptyProductFilters);
              setPage(0);
            }}
            onCreate={() => setCreateOpen(true)}
            onExport={canExport ? exportProductsCsv : undefined}
            onFiltersChange={(patch) => {
              setPage(0);
              setFilters((current) => ({ ...current, ...patch }));
            }}
            onSortChange={(value) => {
              setPage(0);
              setSortPreset(value);
            }}
          />

          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <Package aria-hidden="true" className="h-8 w-8 text-[#b7c3d6]" />
              <p className="text-sm font-semibold text-[#24334c]">
                {hasActiveFilters ? t("emptyFilteredTitle") : t("emptyTitle")}
              </p>
              <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">
                {hasActiveFilters ? t("emptyFilteredBody") : t("emptyBody")}
              </p>
              {hasActiveFilters ? (
                <button
                  className="action-motion soft-button mt-2 h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
                  type="button"
                  onClick={() => {
                    setFilters(emptyProductFilters);
                    setPage(0);
                  }}
                >
                  {t("clear")}
                </button>
              ) : canCreate ? (
                <button
                  className="action-motion soft-primary mt-2 h-9 rounded-[9px] px-3 text-xs font-semibold text-white"
                  type="button"
                  onClick={() => setCreateOpen(true)}
                >
                  {t("addAction")}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="hidden min-h-0 flex-1 flex-col lg:flex">
                <ProductTable
                  products={visible}
                  selectedId={selectedId}
                  usage={usageAll}
                  onOpen={(id) => openProduct(id, "view")}
                />
              </div>
              <ProductMobileList
                products={visible}
                usage={usageAll}
                onOpen={(id) => openProduct(id, "view")}
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
                {t("footerValue", { amount: formatMoneyFromCents(filteredCatalogValue) })}
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
                type="button"
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                {t("pagination.prev")}
              </button>
              <span className="min-w-[3.5rem] text-center text-[11px] font-semibold tabular-nums text-[#516078]">
                {safePage + 1}/{pageCount}
              </span>
              <button
                className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078] disabled:opacity-40"
                disabled={safePage >= pageCount - 1}
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
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
        open={selected !== null}
        showHeader={false}
        title={selected?.name ?? t("title")}
        widthClassName="sm:max-w-[520px]"
        zIndexClassName="z-[60]"
        onClose={() => {
          setSelectedId(null);
          setPanelMode("view");
        }}
      >
        {selected ? (
          <ProductDetailsPanel
            activities={selectedActivities}
            canUpdate={canUpdate}
            customers={customers}
            key={`${selected.id}-${panelMode}-${selected.updatedAt}`}
            mode={panelMode}
            prices={selectedPrices}
            product={selected}
            usage={selectedUsage}
            onActivate={() => {
              updateProduct(selected.id, { status: "active" });
              setNotice(t("notices.activated"));
            }}
            onAddPrice={(customerId, unitPriceCents) => {
              const customer = customers.find((item) => item.id === customerId);
              return upsertCustomerPrice({
                productId: selected.id,
                customerId,
                unitPriceCents,
                customerName: customer?.name,
              });
            }}
            onCancelEdit={() => setPanelMode("view")}
            onClose={() => {
              setSelectedId(null);
              setPanelMode("view");
            }}
            onDeactivate={() => {
              updateProduct(selected.id, { status: "inactive" });
              setNotice(t("notices.deactivated"));
            }}
            onEdit={() => setPanelMode("edit")}
            onRemovePrice={(priceId) => {
              const price = selectedPrices.find((item) => item.id === priceId);
              const customer = customers.find((item) => item.id === price?.customerId);
              removeCustomerPrice(priceId, "You", customer?.name);
              setNotice(t("notices.priceRemoved"));
            }}
            onSave={(patch) => {
              const result = updateProduct(selected.id, patch);
              if (result.ok) {
                setPanelMode("view");
                setNotice(t("notices.updated"));
              }
              return result;
            }}
          />
        ) : null}
      </FormSheet>

      <ProductFormSheet
        companyId={companyId}
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        saving={saving}
        onClose={() => setCreateOpen(false)}
        onSave={(input) => {
          if (saving) return { ok: false, error: "failed" };
          setSaving(true);
          const result = createProduct(input);
          setSaving(false);
          if (result.ok) {
            setCreateOpen(false);
            setSelectedId(result.product.id);
            setPanelMode("view");
            setNotice(t("notices.created"));
          }
          return result;
        }}
      />

      {notice ? (
        <SoftToast message={notice} tone="success" onDismiss={() => setNotice("")} />
      ) : null}
    </main>
  );
}
