"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { selectionReduced, selectionSpring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const SIDEBAR_ACTIVE_LAYOUT_ID = "compte-sidebar-active";
export const TOP_TABS_ACTIVE_LAYOUT_ID = "compte-top-tabs-active";
export const QUOTE_FILTER_ACTIVE_LAYOUT_ID = "compte-quote-filter-active";

export type ActiveIndicatorVariant = "sidebar" | "soft-pill";

/**
 * Soft elevation that follows the pill radius.
 * Prefer filter drop-shadow over box-shadow so Motion layoutId morphs
 * don’t paint a square shadow behind the rounded surface.
 */
export const SIDEBAR_ACTIVE_SURFACE_CLASS =
  "sidebar-active-surface rounded-[14px] border border-white/55 bg-[linear-gradient(145deg,rgb(249_250_251),rgb(236_239_244))]";

const variantClass: Record<ActiveIndicatorVariant, string> = {
  sidebar: SIDEBAR_ACTIVE_SURFACE_CLASS,
  "soft-pill":
    "rounded-full border border-[rgba(156,163,175,0.35)] bg-[linear-gradient(145deg,rgb(249_250_251),rgb(229_231_235))] shadow-[inset_2px_2px_5px_rgba(55,65,81,0.06),inset_-2px_-2px_5px_rgba(255,255,255,0.7)]",
};

type AnimatedSelectionGroupProps = {
  id: string;
  children: ReactNode;
  className?: string;
};

/** Scopes shared layoutIds so unrelated selection groups never morph into each other. */
export function AnimatedSelectionGroup({
  id,
  children,
  className,
}: AnimatedSelectionGroupProps) {
  return (
    <LayoutGroup id={id}>
      <div className={className}>{children}</div>
    </LayoutGroup>
  );
}

type AnimatedActiveIndicatorProps = {
  layoutId: string;
  variant?: ActiveIndicatorVariant;
  className?: string;
  /** Override layout border radius (defaults: sidebar 14, soft-pill 9999). */
  borderRadius?: number;
};

/**
 * Single shared active surface. Render once inside the active item only —
 * Motion morphs the same layoutId between siblings.
 */
export function AnimatedActiveIndicator({
  layoutId,
  variant = "sidebar",
  className,
  borderRadius,
}: AnimatedActiveIndicatorProps) {
  const reduceMotion = useReducedMotion();
  const radius = borderRadius ?? (variant === "sidebar" ? 14 : 9999);
  // useReducedMotion() is null on the server and boolean after mount — keep the
  // first paint identical to SSR to avoid a hydration mismatch.
  const transition = reduceMotion === true ? selectionReduced : selectionSpring;

  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0",
        variantClass[variant],
        className,
      )}
      layoutId={layoutId}
      style={{ borderRadius: radius }}
      transition={transition}
    />
  );
}
