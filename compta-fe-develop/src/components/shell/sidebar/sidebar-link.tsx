"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

import {
  AnimatedActiveIndicator,
  SIDEBAR_ACTIVE_LAYOUT_ID,
  SIDEBAR_ACTIVE_SURFACE_CLASS,
} from "@/components/compte/animated-selection";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { useSidebar } from "./sidebar-context";
import { isExactHref, type SidebarNavLink } from "./sidebar-nav-data";
import { SidebarTooltip } from "./sidebar-tooltip";

type SidebarLinkProps = {
  link: SidebarNavLink;
  label: string;
  active: boolean;
  comingSoon: string;
  className?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;

function LabelSlot({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const instant = reduceMotion === true;

  return (
    <motion.span
      animate={{
        opacity: open ? 1 : 0,
        x: open ? 0 : -4,
        maxWidth: open ? 180 : 0,
      }}
      className="min-w-0 overflow-hidden whitespace-nowrap"
      initial={false}
      transition={{
        duration: instant ? 0.01 : 0.2,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.span>
  );
}

export function SidebarLink({
  link,
  label,
  active,
  comingSoon,
  className,
  ...rest
}: SidebarLinkProps) {
  const { open } = useSidebar();
  const pathname = usePathname();
  const Icon = link.icon;
  const collapsed = !open;
  const showBadge = Boolean(link.count) && !collapsed;
  const showDot = Boolean(link.count) && collapsed;

  const classNames = cn(
    "nav-item group relative flex items-center rounded-[14px] text-left text-sm transition-colors duration-150 ease-out",
    // Collapsed rail: fixed square hit-target (matches company / assistant tiles).
    // Separate layoutId below so expand↔collapse does not morph/slide the pill.
    collapsed
      ? "mx-auto h-11 w-11 shrink-0 justify-center px-0"
      : "h-11 w-full min-w-0 gap-3 px-3",
    active ? "font-semibold text-[#044ce2]" : "text-[#66758d] hover:text-[#24334c]",
    className,
  );

  const inner = (
    <>
      {active ? (
        collapsed ? (
          // Static square — no shared layoutId, so collapse never morphs/slides the pill.
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 z-0",
              SIDEBAR_ACTIVE_SURFACE_CLASS,
            )}
          />
        ) : (
          <AnimatedActiveIndicator
            layoutId={SIDEBAR_ACTIVE_LAYOUT_ID}
            variant="sidebar"
          />
        )
      ) : null}
      <span
        className={cn(
          "relative z-[1] flex min-w-0 items-center transition-transform duration-[90ms] ease-out group-active:scale-[0.985]",
          collapsed ? "justify-center" : "flex-1 gap-3",
        )}
      >
        <span className="relative grid h-5 w-5 shrink-0 place-items-center">
          <Icon
            aria-hidden="true"
            className={cn(
              "h-5 w-5 transition-[color,transform] duration-150 ease-out",
              active ? "scale-[1.04] text-[#044ce2]" : "text-current",
            )}
          />
          {showDot ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#044ce2]"
            />
          ) : null}
        </span>

        {!collapsed ? (
          <LabelSlot open>
            <span className="flex min-w-0 items-center gap-3">
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {showBadge ? (
                <span
                  className={cn(
                    "rounded-[6px] bg-white px-2 py-0.5 text-xs text-[#044ce2] shadow-[0_1px_2px_rgb(20_32_51/0.06)]",
                    active ? "opacity-100" : "opacity-90",
                  )}
                >
                  {link.count}
                </span>
              ) : null}
            </span>
          </LabelSlot>
        ) : null}
      </span>
    </>
  );

  const control = link.href ? (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={classNames}
      href={link.href}
      onClick={(event) => {
        if (isExactHref(pathname, link)) {
          event.preventDefault();
        }
      }}
      {...rest}
    >
      {inner}
    </Link>
  ) : (
    <button
      aria-disabled="true"
      aria-label={collapsed ? label : undefined}
      className={classNames}
      disabled
      title={comingSoon}
      type="button"
    >
      {inner}
    </button>
  );

  return (
    <SidebarTooltip enabled={collapsed} label={label}>
      {control}
    </SidebarTooltip>
  );
}
