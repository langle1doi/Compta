"use client";

import { Check, ChevronDown, Funnel, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CountryFlag } from "@/components/compte/country-flag";
import { cn } from "@/lib/utils";

import type { CustomerFilters, CustomerOwner, CustomerStatus, CustomerType } from "../types";
import { emptyCustomerFilters } from "../types";

type CustomerToolbarProps = {
  filters: CustomerFilters;
  owners: CustomerOwner[];
  tags: string[];
  countries: Array<{ code: string; label: string }>;
  onChange: (next: CustomerFilters) => void;
};

export function CustomerToolbar({
  filters,
  owners,
  tags,
  countries,
  onChange,
}: CustomerToolbarProps) {
  const t = useTranslations("customers.filters");
  const [open, setOpen] = useState(false);
  const [openField, setOpenField] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const activeCount = [
    filters.type !== "all",
    filters.ownerId !== "all",
    filters.tag !== "all",
    filters.country !== "all",
    filters.status !== "all",
  ].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-customer-filter-list]")) return;
      setOpen(false);
      setOpenField(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (openField) {
          setOpenField(null);
          return;
        }
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, openField]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("open")}
        className={cn(
          "action-motion soft-button relative grid h-9 w-9 place-items-center rounded-[9px] text-[#516078]",
          activeCount > 0 && "text-[#044ce2] ring-1 ring-[#044ce2]/25",
        )}
        onClick={() => {
          if (open) {
            setOpen(false);
            setOpenField(null);
            return;
          }
          setOpen(true);
        }}
        type="button"
      >
        <Funnel aria-hidden="true" className="h-4 w-4" strokeWidth={1.9} />
        {activeCount > 0 ? (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#044ce2] px-1 text-[9px] font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          aria-label={t("title")}
          className="absolute top-[calc(100%+6px)] right-0 z-30 w-[min(calc(100vw-2rem),18rem)] overflow-visible rounded-[12px] border border-white/80 bg-white/95 p-3 shadow-[8px_14px_32px_rgba(78,108,145,0.16)] backdrop-blur-sm"
          id={panelId}
          role="dialog"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[#24334c]">{t("title")}</p>
            {activeCount > 0 ? (
              <button
                className="inline-flex items-center gap-1 rounded-[7px] px-1.5 py-1 text-[10px] font-semibold text-[#516078] hover:bg-[#f5f8fd]"
                onClick={() => onChange({ ...emptyCustomerFilters, search: filters.search })}
                type="button"
              >
                <X aria-hidden="true" className="h-3 w-3" />
                {t("clear")}
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <FilterField
              fieldId="type"
              label={t("type")}
              open={openField === "type"}
              options={[
                { value: "all", label: t("all") },
                { value: "company", label: t("company") },
                { value: "individual", label: t("individual") },
              ]}
              value={filters.type}
              onChange={(value) => onChange({ ...filters, type: value as CustomerType | "all" })}
              onOpenChange={(next) => setOpenField(next ? "type" : null)}
            />
            <FilterField
              fieldId="owner"
              label={t("owner")}
              open={openField === "owner"}
              options={[
                { value: "all", label: t("all") },
                ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
              ]}
              value={filters.ownerId}
              onChange={(value) => onChange({ ...filters, ownerId: value })}
              onOpenChange={(next) => setOpenField(next ? "owner" : null)}
            />
            <FilterField
              fieldId="tags"
              label={t("tags")}
              open={openField === "tags"}
              options={[
                { value: "all", label: t("all") },
                ...tags.map((tag) => ({ value: tag, label: tag })),
              ]}
              value={filters.tag}
              onChange={(value) => onChange({ ...filters, tag: value })}
              onOpenChange={(next) => setOpenField(next ? "tags" : null)}
            />
            <FilterField
              fieldId="country"
              flagOnly
              label={t("country")}
              open={openField === "country"}
              options={[
                { value: "all", label: t("all") },
                ...countries.map((country) => ({
                  value: country.code,
                  label: country.label,
                  flagCode: country.code,
                })),
              ]}
              value={filters.country}
              onChange={(value) => onChange({ ...filters, country: value })}
              onOpenChange={(next) => setOpenField(next ? "country" : null)}
            />
            <FilterField
              fieldId="status"
              label={t("status")}
              open={openField === "status"}
              options={[
                { value: "all", label: t("all") },
                { value: "active", label: t("active") },
                { value: "inactive", label: t("inactive") },
              ]}
              value={filters.status}
              onChange={(value) => onChange({ ...filters, status: value as CustomerStatus | "all" })}
              onOpenChange={(next) => setOpenField(next ? "status" : null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterField({
  fieldId,
  label,
  value,
  options,
  open,
  onChange,
  onOpenChange,
  flagOnly = false,
}: {
  fieldId: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string; flagCode?: string }>;
  open: boolean;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  flagOnly?: boolean;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuBox({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="relative flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[0.02em] text-[#7d8aa0] uppercase">
        {label}
      </span>
      <button
        ref={triggerRef}
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-[9px] border bg-white px-2.5 text-left text-[12px] font-semibold text-[#24334c] outline-none",
          open
            ? "border-[#044ce2] ring-[3px] ring-[#044ce2]/20"
            : "border-[#e2eaf5] focus-visible:ring-[3px] focus-visible:ring-[#044ce2]/20",
        )}
        type="button"
        onClick={() => onOpenChange(!open)}
      >
        {flagOnly && selected?.flagCode ? (
          <CountryFlag className="h-3.5 w-5" code={selected.flagCode} title={selected.label} />
        ) : (
          <span className="min-w-0 truncate">{selected?.label ?? value}</span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[#7d8aa0] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && menuBox
        ? createPortal(
            <ul
              aria-label={label}
              className="fixed z-[80] max-h-48 overflow-y-auto rounded-[10px] border border-[#e2eaf5] bg-white py-1 shadow-[0_12px_28px_rgba(29,43,68,0.14)]"
              data-customer-filter-list={fieldId}
              id={listId}
              role="listbox"
              style={{
                top: menuBox.top,
                left: menuBox.left,
                width: menuBox.width,
              }}
            >
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <li key={`${fieldId}-${option.value}`} role="none">
                    <button
                      aria-selected={active}
                      className={cn(
                        "flex min-h-9 w-full items-center justify-between gap-2 px-2.5 text-left text-[12px] font-medium",
                        active
                          ? "bg-[#eef4ff] text-[#044ce2]"
                          : "text-[#24334c] hover:bg-[#f5f8fd]",
                      )}
                      role="option"
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        onOpenChange(false);
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {option.flagCode ? (
                          <CountryFlag
                            className="h-3.5 w-5"
                            code={option.flagCode}
                            title={option.label}
                          />
                        ) : null}
                        <span className="min-w-0 truncate">{option.label}</span>
                      </span>
                      {active ? (
                        <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
