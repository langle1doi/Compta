"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { CountryFlag } from "@/components/compte/country-flag";
import { cn } from "@/lib/utils";

import {
  customerCountry,
  customerCountryCode,
  customerInitials,
  customerTermsLabel,
  formatRelativeActivity,
  getPrimaryEmail,
} from "../query";
import type { CustomerOwner, CustomerRecord } from "../types";

export function CustomerMobileList({
  customers,
  owners,
  selectedId,
  onSelect,
}: {
  customers: CustomerRecord[];
  owners: CustomerOwner[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("customers");

  return (
    <ul className="flex flex-col gap-2 lg:hidden">
      {customers.map((customer) => {
        const owner = owners.find((item) => item.id === customer.ownerId);
        const relative = formatRelativeActivity(customer.lastActivityAt);
        const active = selectedId === customer.id;
        return (
          <li key={customer.id}>
            <button
              className={cn(
                "dashboard-card flex w-full min-w-0 flex-col gap-2 px-3.5 py-3 text-left",
                active && "ring-1 ring-[#044ce2]/35",
              )}
              onClick={() => onSelect(customer.id)}
              type="button"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="dashboard-list__avatar shrink-0">{customerInitials(customer)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate font-semibold text-[#24334c]">{customer.displayName}</p>
                    {customer.possibleDuplicate ? (
                      <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#c46b12]" />
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-[#7d8aa0]">{getPrimaryEmail(customer)}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-[6px] px-2 py-0.5 text-[10px] font-semibold",
                    customer.status === "active"
                      ? "bg-[#e6f7ef] text-[#0f8a5f]"
                      : "bg-[#eef1f5] text-[#66758d]",
                  )}
                >
                  {t(`status.${customer.status}`)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#66758d]">
                <span>{t(`type.${customer.type}`)}</span>
                <span className="inline-flex items-center" title={customerCountry(customer)}>
                  <CountryFlag
                    className="h-3.5 w-5"
                    code={customerCountryCode(customer)}
                    title={customerCountry(customer)}
                  />
                </span>
                <span>{owner?.name}</span>
                <span>{customerTermsLabel(t, customer)}</span>
                <span>
                  {relative.key === "today"
                    ? t("relative.today")
                    : t(`relative.${relative.key}`, { count: relative.count ?? 0 })}
                </span>
              </div>
              {customer.tags.length ? (
                <div className="flex flex-wrap gap-1">
                  {customer.tags.slice(0, 3).map((tag) => (
                    <span
                      className="rounded-[6px] bg-[#eef3fa] px-1.5 py-0.5 text-[10px] font-medium text-[#516078]"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
