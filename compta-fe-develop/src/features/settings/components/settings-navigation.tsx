"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { canOpenRoute } from "../route-permissions";
import { usePermissions } from "../session-provider";
import { SETTINGS_NAV_ITEMS, matchSettingsNavId } from "../settings-nav";

export const SETTINGS_NAV_ACTIVE_LAYOUT_ID = "compte-settings-nav-active";

export function SettingsNavigation({ className }: { className?: string }) {
  const t = useTranslations("usersPermissions");
  const pathname = usePathname();
  const router = useRouter();
  const activeId = matchSettingsNavId(pathname);
  const selectId = useId();
  const permissions = usePermissions();
  const items = SETTINGS_NAV_ITEMS.filter(
    (item) => !item.href || canOpenRoute(item.href, permissions),
  );

  return (
    <>
      <nav
        aria-label={t("nav.label")}
        className={cn(
          "settings-nav dashboard-card hidden min-w-0 flex-col p-2 lg:flex",
          className,
        )}
      >
        <p className="dashboard-label px-3 pt-2 pb-1.5 font-semibold tracking-[0.08em] uppercase">
          {t("nav.section")}
        </p>
        <AnimatedSelectionGroup id="compte-settings-nav">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = item.id === activeId;
              const label = t(item.labelKey);

              if (!item.available || !item.href) {
                return (
                  <li key={item.id}>
                    <span
                      className="flex h-10 items-center rounded-[12px] px-3 text-sm leading-none text-[#98a4b5]"
                      title={t("nav.comingSoon")}
                    >
                      {label}
                    </span>
                  </li>
                );
              }

              return (
                <li key={item.id}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "settings-nav__item relative flex h-10 items-center rounded-[12px] px-3 text-sm leading-none transition-colors duration-150",
                      active
                        ? "font-semibold text-[#044ce2]"
                        : "text-[#5f6f88] hover:text-[#24334c]",
                    )}
                    href={item.href}
                  >
                    {active ? (
                      <AnimatedActiveIndicator
                        borderRadius={12}
                        className="rounded-[12px]"
                        layoutId={SETTINGS_NAV_ACTIVE_LAYOUT_ID}
                        variant="sidebar"
                      />
                    ) : null}
                    <span className="settings-nav__label relative z-[1]">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </AnimatedSelectionGroup>
      </nav>

      <div className="lg:hidden">
        <label className="sr-only" htmlFor={selectId}>
          {t("nav.label")}
        </label>
        <div className="relative">
          <select
            className="soft-button h-11 w-full appearance-none rounded-[12px] border border-[#dfe6f1] bg-white px-3 pr-10 text-sm font-semibold text-[#063586]"
            id={selectId}
            value={activeId}
            onChange={(event) => {
              const item = items.find((entry) => entry.id === event.target.value);
              if (item?.href) router.push(item.href);
            }}
          >
            {items.map((item) => (
              <option disabled={!item.available} key={item.id} value={item.id}>
                {t(item.labelKey)}
                {!item.available ? ` (${t("nav.comingSoon")})` : ""}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#66758d]"
          />
        </div>
      </div>
    </>
  );
}
