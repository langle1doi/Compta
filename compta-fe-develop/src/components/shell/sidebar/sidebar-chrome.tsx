"use client";

import { Bot, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAssistantOptional } from "@/components/assistant";
import { BrandLogo } from "@/components/brand-logo";
import { AnimatedSelectionGroup } from "@/components/compte/animated-selection";
import { CompanySwitcher } from "@/components/shell/company-switcher";
import { useCan } from "@/features/settings/can";
import { canOpenRoute } from "@/features/settings/route-permissions";
import { usePermissions } from "@/features/settings/session-provider";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { SidebarSearch } from "./sidebar";
import { useSidebar } from "./sidebar-context";
import { SidebarLink } from "./sidebar-link";
import {
  type SidebarNavLink,
  mainNav,
  matchRouteKey,
  opsNav,
  type NavKey,
} from "./sidebar-nav-data";
import { SidebarTooltip } from "./sidebar-tooltip";

export function SidebarChrome({
  navigationLabel,
  searchLabel,
}: {
  navigationLabel: string;
  searchLabel: string;
}) {
  const t = useTranslations();
  const tSidebar = useTranslations("sidebar");
  const { open, setOpen, isDesktop } = useSidebar();
  // Must track `open` (sidebar width), not only isDesktop — SSR used to
  // report isDesktop=false while the rail was already 76px wide.
  const collapsed = !open;
  const mobileDrawer = !isDesktop;
  const toggleLabel = open ? tSidebar("collapse") : tSidebar("expand");

  const labels: Record<NavKey, string> = {
    "nav.overview": t("nav.overview"),
    "nav.customers": t("nav.customers"),
    "nav.quotes": t("nav.quotes"),
    "nav.invoices": t("nav.invoices"),
    "nav.payments": t("nav.payments"),
    "nav.products": t("nav.products"),
    "nav.reports": t("nav.reports"),
    "nav.automation": t("nav.automation"),
    "nav.projects": t("nav.projects"),
    "nav.templates": t("nav.templates"),
    "nav.integrations": t("nav.integrations"),
    "nav.settings": t("nav.settings"),
  };

  return (
    <>
      <div
        className={cn(
          "relative flex shrink-0 items-center",
          collapsed ? "justify-center px-1 pb-4" : "px-3 pb-6",
          mobileDrawer && "pr-12",
        )}
      >
        {collapsed ? (
          <SidebarTooltip enabled label="COMPTA">
            <span className="mx-auto flex h-11 w-11 items-center justify-center">
              <BrandLogo className="h-10 w-10" mark />
            </span>
          </SidebarTooltip>
        ) : (
          <BrandLogo />
        )}

        {isDesktop ? (
          <div
            className={cn(
              "absolute top-1/2 right-0 z-20 -translate-y-1/2 translate-x-1/2",
              collapsed && "top-3 -translate-y-0",
            )}
          >
            <SidebarTooltip
              className="!block w-auto"
              enabled={collapsed}
              label={toggleLabel}
            >
              <button
                aria-expanded={open}
                aria-label={toggleLabel}
                className="action-motion soft-button grid h-7 w-7 place-items-center rounded-full border border-[#d7e0ee] bg-white text-[#405069] shadow-[0_4px_12px_rgb(29_43_68/0.12)]"
                type="button"
                onClick={() => setOpen(!open)}
              >
                {open ? (
                  <PanelLeftClose aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftOpen aria-hidden="true" className="h-3.5 w-3.5" />
                )}
              </button>
            </SidebarTooltip>
          </div>
        ) : null}
      </div>

      <div className={cn("shrink-0", collapsed && "flex justify-center")}>
        <CompanySwitcher compact={collapsed} />
      </div>

      {!collapsed ? (
        <SidebarSearch
          className="mt-3 shrink-0 min-[480px]:hidden lg:hidden"
          label={searchLabel}
        />
      ) : null}

      <div className="sidebar-scroll mt-5 min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <SidebarNavSections
          comingSoon={t("nav.comingSoon")}
          labels={labels}
          navigationLabel={navigationLabel}
          opsLabel={t("nav.operations")}
        />
      </div>

      <div className={cn("mt-4 shrink-0", collapsed && "flex justify-center")}>
        <AssistantCard collapsed={collapsed} />
      </div>
    </>
  );
}

function SidebarNavSections({
  labels,
  opsLabel,
  comingSoon,
  navigationLabel,
}: {
  labels: Record<NavKey, string>;
  opsLabel: string;
  comingSoon: string;
  navigationLabel: string;
}) {
  const pathname = usePathname();
  const activeKey = matchRouteKey(pathname);
  const { open } = useSidebar();
  const collapsed = !open;
  const permissions = usePermissions();
  const allowed = (item: SidebarNavLink) =>
    Boolean(item.href) && canOpenRoute(item.href ?? "", permissions);
  const mainItems = mainNav.filter(allowed);
  const opsItems = opsNav.filter(allowed);

  return (
    <AnimatedSelectionGroup id="compte-sidebar-nav">
      <nav aria-label={navigationLabel} className="flex flex-col gap-1">
        {mainItems.map((item) => (
          <SidebarLink
            active={activeKey === item.labelKey}
            comingSoon={comingSoon}
            key={item.labelKey}
            label={labels[item.labelKey]}
            link={item}
          />
        ))}
      </nav>

      <div className={cn("mt-7 border-t border-[#edf1f6]", collapsed ? "pt-4" : "pt-5")}>
        {/* Instant hide — height animation shifts rail icons and looks like active slide. */}
        {!collapsed ? (
          <p className="px-3 pb-2 text-[11px] font-bold tracking-[0.12em] text-[#98a4b5]">
            {opsLabel}
          </p>
        ) : null}
        <nav aria-label={opsLabel} className="flex flex-col gap-1">
          {opsItems.map((item) => (
            <SidebarLink
              active={activeKey === item.labelKey}
              comingSoon={comingSoon}
              key={item.labelKey}
              label={labels[item.labelKey]}
              link={item}
            />
          ))}
        </nav>
      </div>
    </AnimatedSelectionGroup>
  );
}

function AssistantCard({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations("sidebar");
  const assistant = useAssistantOptional();
  const check = useCan();

  if (!check("ai.use")) return null;

  if (collapsed) {
    return (
      <SidebarTooltip enabled label={t("assistantTitle")}>
        <span className="flex justify-center">
          <button
            aria-label={t("assistantTitle")}
            className="action-motion grid h-11 w-11 place-items-center rounded-[12px] bg-[#063586] text-white"
            type="button"
            onClick={() => assistant?.openAssistant()}
          >
            <Bot aria-hidden="true" className="h-5 w-5" />
          </button>
        </span>
      </SidebarTooltip>
    );
  }

  return (
    <button
      className="assistant-card flex w-full items-center gap-3 rounded-[15px] bg-[#063586] p-3.5 text-left text-white transition-opacity hover:opacity-95"
      type="button"
      onClick={() => assistant?.openAssistant()}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/12">
        <Bot aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t("assistantTitle")}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[#bec9da]">
          {t("assistantAction")}
        </span>
      </span>
    </button>
  );
}
