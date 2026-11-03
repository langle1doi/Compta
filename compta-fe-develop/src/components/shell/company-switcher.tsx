"use client";

import { Building2, Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { IconTile } from "@/components/dashboard/tone";
import { useSession } from "@/features/settings/session-provider";
import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

import { SidebarTooltip } from "./sidebar/sidebar-tooltip";

export function CompanySwitcher({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("sidebar");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const session = useSession();
  const { setCompanyId } = session;
  const companies = session.companies
    .filter((company) => company.status === "ACTIVE")
    .map((company) => ({
      id: company.id,
      name: company.trade_name || company.legal_name,
      // The legal name adds nothing when it is also the display name.
      subtitle: company.trade_name ? company.legal_name : undefined,
      currency: company.currency,
    }));
  const active = companies.find((company) => company.id === session.companyId);

  useOutsideDismiss({
    active: open,
    onDismiss: () => setOpen(false),
    roots: [rootRef],
  });

  // Nothing to switch between yet (loading), or a user with no active company.
  if (!active) return null;

  const menu = open ? (
    <div
      aria-label={t("companyList")}
      className={cn(
        "company-switcher-menu absolute z-10 max-h-52 space-y-0.5 overflow-y-auto rounded-[12px] border border-[#dce5f0] bg-white p-1.5 shadow-[0_14px_32px_rgb(29_43_68/0.18),0_2px_6px_rgb(29_43_68/0.08)]",
        compact
          ? "top-0 left-full ml-2 w-[220px]"
          : "top-full right-2 left-2 mt-1.5",
      )}
      id={listId}
      role="listbox"
    >
      {companies.map((entry) => {
        const selected = entry.id === active.id;
        return (
          <button
            aria-selected={selected}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left transition-colors duration-150",
              selected
                ? "bg-[#eef4ff] text-[#044ce2] shadow-[2px_3px_8px_rgba(78,108,145,0.08)]"
                : "text-[#405069] hover:bg-[#f4f7fb] hover:text-[#24334c]",
            )}
            key={entry.id}
            role="option"
            type="button"
            onClick={() => {
              setCompanyId(entry.id);
              setOpen(false);
              // Avoid sticky rail tooltip from focus returning to the trigger.
              window.requestAnimationFrame(() => {
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              });
            }}
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-[8px]",
                selected ? "bg-[#e7efff] text-[#044ce2]" : "bg-[#eef3fa]/90 text-[#66758d]",
              )}
            >
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{entry.name}</span>
              <span className="block truncate text-[10px] text-[#7d8aa0]">
                {entry.subtitle ?? entry.currency}
              </span>
            </span>
            {selected ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
          </button>
        );
      })}
    </div>
  ) : null;

  if (compact) {
    return (
      <div
        className={cn(
          "company-switcher relative shrink-0",
          open && "company-switcher--open",
        )}
        ref={rootRef}
      >
        <SidebarTooltip enabled={!open} label={active.name}>
          <button
            aria-controls={listId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={t("switchCompany")}
            className="action-motion soft-button grid h-11 w-11 place-items-center rounded-[12px] text-[#044ce2]"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <Building2 aria-hidden="true" className="h-5 w-5" />
          </button>
        </SidebarTooltip>
        {menu}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "company-switcher sidebar-surface relative shrink-0 rounded-[14px] p-3",
        open && "company-switcher--open",
      )}
      ref={rootRef}
    >
      <div className="flex items-center gap-3">
        <IconTile tone="blue" icon={Building2} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#253550]">{active.name}</p>
          <p className="truncate text-xs text-[#708098]">
            {active.subtitle ?? active.currency ?? t("companyFallback")}
          </p>
        </div>
      </div>

      <button
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="action-motion soft-button mt-3 flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-xs font-medium text-[#516078]"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {t("switchCompany")}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {menu}
    </div>
  );
}
