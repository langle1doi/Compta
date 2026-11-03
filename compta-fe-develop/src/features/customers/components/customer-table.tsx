"use client";

import { AlertTriangle, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { CountryFlag } from "@/components/compte/country-flag";
import { cn } from "@/lib/utils";

import {
  customerCountry,
  customerTermsLabel,
  customerCountryCode,
  customerInitials,
  getPrimaryEmail,
} from "../query";
import type { CustomerOwner, CustomerRecord } from "../types";

type CustomerTableProps = {
  customers: CustomerRecord[];
  owners: CustomerOwner[];
  selectedId: string | null;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
};

export function CustomerTable({
  customers,
  owners,
  selectedId,
  selectedIds,
  onSelect,
  onToggleCheck,
  onToggleAll,
  onOpen,
}: CustomerTableProps) {
  const t = useTranslations("customers");
  const allChecked = customers.length > 0 && selectedIds.length === customers.length;

  return (
    <div className="customer-table-scroll min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto">
      <table className="w-full max-w-full table-fixed border-separate border-spacing-0 text-left text-[13px]">
        <colgroup>
          <col className="w-[4%]" />
          <col className="w-[27%]" />
          <col className="w-[20%]" />
          <col className="w-[10%]" />
          <col className="w-[15%]" />
          <col className="w-[12%]" />
          <col className="w-[8%]" />
          <col className="w-[4%]" />
        </colgroup>
        <thead className="sticky top-0 z-[1] bg-[#f7faff]/96 backdrop-blur-sm">
          <tr className="text-[10px] font-semibold tracking-wide text-[#7d8aa0] uppercase">
            <th className="px-2 py-2">
              <input
                aria-label={t("table.selectAll")}
                checked={allChecked}
                className="h-3.5 w-3.5 accent-[#044ce2]"
                onChange={onToggleAll}
                type="checkbox"
              />
            </th>
            <th className="px-1.5 py-2">{t("table.customer")}</th>
            <th className="px-1.5 py-2">{t("table.legal")}</th>
            <th className="px-1.5 py-2">{t("table.country")}</th>
            <th className="px-1.5 py-2">{t("table.owner")}</th>
            <th className="px-1.5 py-2">{t("table.terms")}</th>
            <th className="px-1.5 py-2">{t("table.status")}</th>
            <th className="px-1 py-2" />
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const owner = owners.find((item) => item.id === customer.ownerId);
            const active = selectedId === customer.id;
            return (
              <tr
                className={cn(
                  "group cursor-pointer border-t border-[#edf2f8] transition-colors duration-150",
                  active ? "bg-[#eef4ff]" : "hover:bg-[#f7faff]",
                )}
                key={customer.id}
                onClick={() => onSelect(customer.id)}
              >
                <td className="relative px-2 py-2">
                  {active ? (
                    <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[#044ce2]" />
                  ) : null}
                  <input
                    aria-label={t("table.selectRow", { name: customer.displayName })}
                    checked={selectedIds.includes(customer.id)}
                    className="h-3.5 w-3.5 accent-[#044ce2]"
                    onChange={() => onToggleCheck(customer.id)}
                    onClick={(event) => event.stopPropagation()}
                    type="checkbox"
                  />
                </td>
                <td className="min-w-0 px-1.5 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="dashboard-list__avatar h-7 w-7 shrink-0 text-[10px]">
                      {customerInitials(customer)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1">
                        <p
                          className="truncate font-semibold text-[#24334c]"
                          title={customer.displayName}
                        >
                          {customer.displayName}
                        </p>
                        {customer.possibleDuplicate ? (
                          <AlertTriangle
                            aria-label={t("duplicate.badge")}
                            className="h-3 w-3 shrink-0 text-[#c46b12]"
                          />
                        ) : null}
                      </div>
                      <p
                        className="truncate text-[11px] text-[#7d8aa0]"
                        title={getPrimaryEmail(customer)}
                      >
                        {getPrimaryEmail(customer)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="min-w-0 px-1.5 py-2">
                  <p
                    className="truncate text-[#405069]"
                    title={customer.legalName ?? customer.displayName}
                  >
                    {customer.type === "company"
                      ? (customer.legalName ?? customer.displayName)
                      : customer.displayName}
                  </p>
                  <p className="truncate text-[11px] text-[#7d8aa0]">
                    {customer.type === "company"
                      ? (customer.vatNumber ?? customer.siret ?? "—")
                      : "—"}
                  </p>
                </td>
                <td className="px-1.5 py-2">
                  <CountryFlag
                    className="h-4 w-6"
                    code={customerCountryCode(customer)}
                    title={customerCountry(customer)}
                  />
                </td>
                <td className="min-w-0 px-1.5 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eaf1ff] text-[9px] font-semibold text-[#1857d7]">
                      {owner?.initials ?? "—"}
                    </span>
                    <span className="min-w-0 truncate text-[#405069]" title={owner?.name}>
                      {owner?.name ?? "—"}
                    </span>
                  </div>
                </td>
                <td className="min-w-0 truncate px-1.5 py-2 text-[#405069]">
                  {customerTermsLabel(t, customer)}
                </td>
                <td className="px-1.5 py-2">
                  <span
                    className={cn(
                      "inline-flex rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold",
                      customer.status === "active"
                        ? "bg-[#e6f7ef] text-[#0f8a5f]"
                        : "bg-[#eef1f5] text-[#66758d]",
                    )}
                  >
                    {t(`status.${customer.status}`)}
                  </span>
                </td>
                <td className="px-1 py-2">
                  <button
                    aria-label={t("table.open", { name: customer.displayName })}
                    className="action-motion grid h-7 w-7 place-items-center rounded-[7px] text-[#7d8aa0] hover:bg-white hover:text-[#044ce2]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(customer.id);
                    }}
                    type="button"
                  >
                    <MoreHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
