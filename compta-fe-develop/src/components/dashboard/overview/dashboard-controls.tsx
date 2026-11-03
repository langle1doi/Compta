"use client";

import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
  TOP_TABS_ACTIVE_LAYOUT_ID,
} from "@/components/compte/animated-selection";
import { useCan } from "@/features/settings/can";
import type { PermissionId } from "@/features/settings/types";
import { cn } from "@/lib/utils";

const sections = [
  { key: "overview", href: "#dashboard-top" },
  { key: "quotes", href: "#dashboard-quotes", permission: "quote.read" },
  { key: "invoices", href: "#dashboard-invoices", permission: "invoice.read" },
  { key: "payments", href: "#dashboard-payments", permission: "payment.read" },
] as const satisfies ReadonlyArray<{ key: string; href: string; permission?: PermissionId }>;

export function DashboardControls() {
  const t = useTranslations("overview");
  const check = useCan();
  const visibleSections = sections.filter(
    (section) => !("permission" in section) || check(section.permission),
  );
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["key"]>("overview");
  const arrivalFrame = useRef<number | null>(null);
  const arrivalLight = useRef<Animation | null>(null);

  useEffect(() => () => {
    if (arrivalFrame.current !== null) cancelAnimationFrame(arrivalFrame.current);
    arrivalLight.current?.cancel();
  }, []);

  function selectSection(section: (typeof sections)[number]) {
    setActiveSection(section.key);
    if (arrivalFrame.current !== null) cancelAnimationFrame(arrivalFrame.current);
    arrivalLight.current?.cancel();
    if (!["quotes", "invoices", "payments"].includes(section.key)) return;

    const target = document.getElementById(section.href.slice(1));
    if (!target) return;

    let started: number | null = null;
    let previousTop = target.getBoundingClientRect().top;
    let stableFrames = 0;
    // Let the existing anchor navigation finish scrolling before lighting the card.
    function waitForArrival(now: number) {
      if (!target?.isConnected) return;
      started ??= now;
      const top = target.getBoundingClientRect().top;
      stableFrames = Math.abs(top - previousTop) < 0.5 ? stableFrames + 1 : 0;
      previousTop = top;
      if ((now - started < 120 || stableFrames < 4) && now - started < 1500) {
        arrivalFrame.current = requestAnimationFrame(waitForArrival);
        return;
      }

      arrivalFrame.current = null;
      const shadow = getComputedStyle(target).boxShadow;
      const light = `${shadow === "none" ? "" : `${shadow}, `}0 0 0 2px rgb(4 76 226 / 0.45), 0 14px 30px -4px rgb(4 76 226 / 0.48), 0 5px 16px -2px rgb(35 201 216 / 0.34)`;
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      arrivalLight.current = target.animate(
        reducedMotion
          ? [{ boxShadow: light }, { boxShadow: light }]
          : [
              { boxShadow: shadow, offset: 0 },
              { boxShadow: light, offset: 0.15 },
              { boxShadow: light, offset: 0.5 },
              { boxShadow: shadow, offset: 1 },
            ],
        { duration: reducedMotion ? 350 : 1600, easing: "ease-out" },
      );
    }
    arrivalFrame.current = requestAnimationFrame(waitForArrival);
  }

  return (
    <div className="dashboard-enter enter-0 flex flex-wrap items-center justify-between gap-2">
      <nav aria-label={t("sections.label")} className="min-w-0 max-w-full">
        <AnimatedSelectionGroup id="compte-top-tabs">
          <ul className="flex flex-wrap gap-1.5">
            {visibleSections.map((section) => {
              const active = activeSection === section.key;
              return (
                <li key={section.key}>
                  <a
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "dashboard-pill relative",
                      active && "dashboard-pill--indicator-active",
                    )}
                    href={section.href}
                    onClick={() => selectSection(section)}
                  >
                    {active ? (
                      <AnimatedActiveIndicator
                        layoutId={TOP_TABS_ACTIVE_LAYOUT_ID}
                        variant="soft-pill"
                      />
                    ) : null}
                    <span className="relative z-[1]">{t(`sections.${section.key}`)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </AnimatedSelectionGroup>
      </nav>

      <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[#d9e3ef] bg-white px-2.5 text-[10px] font-semibold text-[#13284a]">
        <CalendarDays aria-hidden="true" className="h-3 w-3 text-[#2f66e8]" />
        {t("period.current")}
      </span>
    </div>
  );
}
