"use client";

import { useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
  QUOTE_FILTER_ACTIVE_LAYOUT_ID,
} from "@/components/compte/animated-selection";
import { cn } from "@/lib/utils";

type QuoteStatusFiltersProps = {
  labels: string[];
  value?: number;
  onChange?: (index: number) => void;
};

export function QuoteStatusFilters({ labels, value, onChange }: QuoteStatusFiltersProps) {
  const [uncontrolled, setUncontrolled] = useState(0);
  const activeIndex = value ?? uncontrolled;
  const setActiveIndex = onChange ?? setUncontrolled;

  return (
    <AnimatedSelectionGroup
      className="dashboard-list__filters"
      id="compte-quote-filters"
    >
      {labels.map((tab, index) => {
        const active = activeIndex === index;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "dashboard-pill dashboard-pill--list relative",
              active && "dashboard-pill--indicator-active",
            )}
            key={tab}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            {active ? (
              <AnimatedActiveIndicator
                layoutId={QUOTE_FILTER_ACTIVE_LAYOUT_ID}
                variant="soft-pill"
              />
            ) : null}
            <span className="relative z-[1]">{tab}</span>
          </button>
        );
      })}
    </AnimatedSelectionGroup>
  );
}
