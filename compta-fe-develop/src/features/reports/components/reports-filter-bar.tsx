"use client";

import { Filter, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SoftSelect } from "@/components/compte/soft-select";
import { FormSheet } from "@/components/forms/form-sheet";
import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

import { filtersAreDefault } from "../calculations";
import type { ReportFilters, ReportPeriodPreset } from "../model";

const MORE_PANEL_GAP = 6;
const MORE_PANEL_EDGE = 8;
const MORE_PANEL_WIDTH = 280;

const PERIODS: ReportPeriodPreset[] = [
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "this_year",
  "previous_year",
];

export function ReportsFilterBar({
  filters,
  companies,
  owners,
  customers,
  products,
  currencies,
  activeCompanyId,
  canFilterCompany,
  canFilterSalesperson,
  onChange,
  onClear,
}: {
  filters: ReportFilters;
  companies: Array<{ id: string; name: string }>;
  owners: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  currencies: string[];
  activeCompanyId: string;
  canFilterCompany: boolean;
  canFilterSalesperson: boolean;
  onChange: (patch: Partial<ReportFilters>) => void;
  onClear: () => void;
}) {
  const t = useTranslations("reports");
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelBox, setPanelBox] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const panelId = useId();
  const moreRootRef = useRef<HTMLDivElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const dirty = !filtersAreDefault(filters, activeCompanyId);
  const moreActive = Boolean(filters.quoteStatus || filters.invoiceStatus);

  const closeMore = useCallback(() => {
    setMoreOpen(false);
    setPanelBox(null);
  }, []);
  const moreDismissRoots = useMemo(() => [moreRootRef, morePanelRef], []);

  useOutsideDismiss({
    active: moreOpen,
    onDismiss: closeMore,
    roots: moreDismissRoots,
    allowSelector: "[data-soft-select-list]",
  });

  useLayoutEffect(() => {
    if (!moreOpen) return;

    function updatePosition() {
      const trigger = moreTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(MORE_PANEL_WIDTH, window.innerWidth - MORE_PANEL_EDGE * 2);
      const left = Math.min(
        Math.max(MORE_PANEL_EDGE, rect.right - width),
        window.innerWidth - width - MORE_PANEL_EDGE,
      );
      setPanelBox({
        top: rect.bottom + MORE_PANEL_GAP,
        left,
        width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [moreOpen]);

  const periodOptions = PERIODS.map((period) => ({
    value: period,
    label: t(`period.${period}`),
  }));

  const companyOptions = [
    {
      value: activeCompanyId,
      label: companies.find((c) => c.id === activeCompanyId)?.name ?? activeCompanyId,
    },
    { value: "all", label: t("filters.allCompanies") },
    ...companies
      .filter((company) => company.id !== activeCompanyId)
      .map((company) => ({ value: company.id, label: company.name })),
  ];

  const controls = (
    <>
      <SoftSelect
        className="w-[8.5rem] shrink-0"
        hideLabel
        label={t("filters.period")}
        options={periodOptions}
        triggerClassName="font-semibold text-[#405069]"
        value={filters.period}
        onChange={(value) => onChange({ period: value as ReportPeriodPreset })}
      />
      {canFilterCompany ? (
        <SoftSelect
          className="w-[10rem] shrink-0"
          hideLabel
          label={t("filters.company")}
          options={companyOptions}
          triggerClassName="font-semibold text-[#405069]"
          value={filters.companyId ?? activeCompanyId}
          onChange={(value) =>
            onChange({ companyId: value === activeCompanyId ? null : (value as "all" | string) })
          }
        />
      ) : null}
      <SoftSelect
        className="w-[5.5rem] shrink-0"
        hideLabel
        label={t("filters.currency")}
        options={currencies.map((currency) => ({ value: currency, label: currency }))}
        triggerClassName="font-semibold text-[#405069]"
        value={filters.currency}
        onChange={(value) => onChange({ currency: value })}
      />
      {canFilterSalesperson ? (
        <SoftSelect
          className="w-[10.5rem] shrink-0"
          hideLabel
          label={t("filters.salesperson")}
          options={[
            { value: "", label: t("filters.anySalesperson") },
            ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
          ]}
          triggerClassName="font-semibold text-[#405069]"
          value={filters.salespersonId ?? ""}
          onChange={(value) => onChange({ salespersonId: value || null })}
        />
      ) : null}
      <SoftSelect
        className="w-[10.5rem] shrink-0"
        hideLabel
        label={t("filters.customer")}
        options={[
          { value: "", label: t("filters.anyCustomer") },
          ...customers.map((customer) => ({ value: customer.id, label: customer.name })),
        ]}
        triggerClassName="font-semibold text-[#405069]"
        value={filters.customerId ?? ""}
        onChange={(value) => onChange({ customerId: value || null })}
      />
      <SoftSelect
        className="w-[10.5rem] shrink-0"
        hideLabel
        label={t("filters.product")}
        options={[
          { value: "", label: t("filters.anyProduct") },
          ...products.map((product) => ({ value: product.id, label: product.name })),
        ]}
        triggerClassName="font-semibold text-[#405069]"
        value={filters.productId ?? ""}
        onChange={(value) => onChange({ productId: value || null })}
      />
    </>
  );

  return (
    <>
      <div className="dashboard-card relative z-30 flex shrink-0 flex-col gap-1.5 overflow-visible px-3 py-2">
        <div className="hidden min-w-0 flex-wrap items-center gap-1.5 md:flex">
          {controls}
          <div className="relative shrink-0" ref={moreRootRef}>
            <button
              ref={moreTriggerRef}
              aria-controls={moreOpen ? panelId : undefined}
              aria-expanded={moreOpen}
              className={cn(
                "action-motion soft-button inline-flex h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold text-[#405069]",
                moreActive && "ring-1 ring-[#044ce2]/25",
              )}
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <Filter aria-hidden="true" className="h-3.5 w-3.5" />
              {t("filters.more")}
            </button>
            {moreOpen
              ? createPortal(
                  <div
                    ref={morePanelRef}
                    className="fixed z-[100] rounded-[12px] border border-[#e1e7f1] bg-white p-3 shadow-[0_12px_28px_rgba(29,43,68,0.14)]"
                    id={panelId}
                    style={
                      panelBox
                        ? {
                            top: panelBox.top,
                            left: panelBox.left,
                            width: panelBox.width,
                          }
                        : { top: -9999, left: -9999, visibility: "hidden" }
                    }
                  >
                    <div className="space-y-2.5">
                      <SoftSelect
                        label={t("filters.quoteStatus")}
                        options={[
                          { value: "", label: t("filters.anyStatus") },
                          ...(
                            ["draft", "sent", "review", "accepted", "rejected", "expired"] as const
                          ).map((status) => ({
                            value: status,
                            label: t(`quoteStatus.${status}`),
                          })),
                        ]}
                        value={filters.quoteStatus ?? ""}
                        onChange={(value) => onChange({ quoteStatus: value || null })}
                      />
                      <SoftSelect
                        label={t("filters.invoiceStatus")}
                        options={[
                          { value: "", label: t("filters.anyStatus") },
                          ...(["draft", "to_validate", "validated", "sent"] as const).map(
                            (status) => ({
                              value: status,
                              label: t(`invoiceStatus.${status}`),
                            }),
                          ),
                        ]}
                        value={filters.invoiceStatus ?? ""}
                        onChange={(value) => onChange({ invoiceStatus: value || null })}
                      />
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          </div>
          <button
            className={cn(
              "action-motion ml-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-[9px] px-2 text-xs font-semibold",
              dirty
                ? "text-[#516078] hover:bg-[#f5f8fd]"
                : "pointer-events-none text-[#b7c3d6]",
            )}
            disabled={!dirty}
            type="button"
            onClick={onClear}
          >
            {t("filters.clearAll")}
          </button>
        </div>

        <div className="flex items-center gap-1.5 md:hidden">
          <button
            className="action-motion soft-button inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold text-[#405069]"
            type="button"
            onClick={() => setMobileOpen(true)}
          >
            <Search aria-hidden="true" className="h-3.5 w-3.5" />
            {t("filters.openMobile")}
            {dirty ? (
              <span className="rounded-full bg-[#e7efff] px-1.5 py-0.5 text-[10px] font-semibold text-[#044ce2]">
                {t("filters.active")}
              </span>
            ) : null}
          </button>
          {dirty ? (
            <button
              className="action-motion soft-button grid h-9 w-9 place-items-center rounded-[9px] text-[#516078]"
              type="button"
              onClick={onClear}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <FormSheet
        open={mobileOpen}
        title={t("filters.title")}
        description={t("filters.mobileHint")}
        onClose={() => setMobileOpen(false)}
        widthClassName="sm:max-w-[420px]"
        closeLabel={t("close")}
        footer={
          <div className="flex gap-2">
            <button
              className="action-motion soft-button h-10 flex-1 rounded-[10px] text-sm font-semibold text-[#405069]"
              type="button"
              onClick={() => {
                onClear();
                setMobileOpen(false);
              }}
            >
              {t("filters.clearAll")}
            </button>
            <button
              className="action-motion soft-primary h-10 flex-1 rounded-[10px] text-sm font-semibold text-white"
              type="button"
              onClick={() => setMobileOpen(false)}
            >
              {t("filters.apply")}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-2.5 p-4 [&>*]:w-full">{controls}</div>
      </FormSheet>
    </>
  );
}
