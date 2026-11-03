"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";

import { useNestedScrollChain } from "@/lib/use-nested-scroll-chain";
import { cn } from "@/lib/utils";

/**
 * Nested list scroller for multi-panel pages (dashboard cards).
 * At list edges, wheel/trackpad continues the page scroll.
 * FormSheets / single-list pages should keep plain `.dashboard-scroll` (contain).
 */
export function DashboardScroll({
  children,
  scrollClassName = "overflow-x-hidden overflow-y-auto",
  chain = true,
}: {
  children: ReactNode;
  scrollClassName?: string;
  /** Pass remaining wheel delta to the page scroller at list edges. */
  chain?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useNestedScrollChain(scrollRef, chain);

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className={cn(
          "dashboard-scroll h-full min-h-0",
          chain && "dashboard-scroll--chain",
          scrollClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Attach scroll-to-page chaining to an existing overflow container. */
export function NestedScrollChain({
  chain = true,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { chain?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useNestedScrollChain(scrollRef, chain);

  return (
    <div
      ref={scrollRef}
      className={cn(chain && "dashboard-scroll--chain", className)}
      {...props}
    >
      {children}
    </div>
  );
}
