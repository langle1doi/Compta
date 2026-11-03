"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn } from "@/lib/utils";

import { CATEGORY_ORDER } from "../catalog";
import type { IntegrationCategory } from "../model";

type CategoryId = IntegrationCategory | "all";

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  locked: boolean;
};

export function IntegrationCategories({
  active,
  counts,
  onChange,
}: {
  active: CategoryId;
  counts: Record<string, number>;
  onChange: (category: CategoryId) => void;
}) {
  const t = useTranslations("integrations.categories");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const inertiaFrame = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [canScroll, setCanScroll] = useState(false);

  const stopInertia = useCallback(() => {
    if (inertiaFrame.current !== null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }
  }, []);

  const updateMetrics = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScroll(el.scrollWidth > el.clientWidth + 2);
  }, []);

  useEffect(() => {
    updateMetrics();
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => updateMetrics());
    observer.observe(el);
    window.addEventListener("resize", updateMetrics);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMetrics);
      stopInertia();
    };
  }, [stopInertia, updateMetrics, counts]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const activeButton = el.querySelector<HTMLElement>(
      `[data-category='${active}']`,
    );
    if (!activeButton) return;
    activeButton.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [active]);

  const runInertia = useCallback(
    (initialVelocity: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      stopInertia();
      let velocity = initialVelocity;
      const step = () => {
        const node = scrollerRef.current;
        if (!node) return;
        node.scrollLeft += velocity;
        updateMetrics();
        velocity *= 0.9;
        if (Math.abs(velocity) > 0.35) {
          inertiaFrame.current = requestAnimationFrame(step);
        } else {
          inertiaFrame.current = null;
        }
      };
      inertiaFrame.current = requestAnimationFrame(step);
    },
    [stopInertia, updateMetrics],
  );

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 2) return;

    stopInertia();
    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: el.scrollLeft,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
      locked: false,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || !el || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.locked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      drag.locked = true;
      suppressClickRef.current = true;
      setDragging(true);
      el.setPointerCapture(event.pointerId);
    }

    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    el.scrollLeft = Math.min(max, Math.max(0, drag.startScrollLeft - dx));
    updateMetrics();

    const now = performance.now();
    const dt = Math.max(8, now - drag.lastTime);
    drag.velocity = ((event.clientX - drag.lastX) / dt) * 16;
    drag.lastX = event.clientX;
    drag.lastTime = now;
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || !el || event.pointerId !== drag.pointerId) return;

    const wasLocked = drag.locked;
    const velocity = drag.velocity;
    dragRef.current = null;
    setDragging(false);

    if (wasLocked && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
      runInertia(-velocity);
    }

    if (wasLocked) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }

  function handleSelect(category: CategoryId) {
    if (suppressClickRef.current) return;
    onChange(category);
  }

  return (
    <div className="integration-category-carousel relative min-w-0 w-full flex-1 basis-0">
      <div
        ref={scrollerRef}
        aria-label={t("label")}
        className={cn(
          "integration-category-scroller flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain py-0.5",
          canScroll && "integration-category-scroller--pannable",
          dragging && "integration-category-scroller--dragging",
        )}
        role="tablist"
        onPointerCancel={endDrag}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onScroll={updateMetrics}
      >
        {CATEGORY_ORDER.map((category) => {
          const selected = active === category;
          const count = counts[category] ?? 0;
          return (
            <button
              aria-selected={selected}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[12px] font-semibold transition-colors select-none",
                selected
                  ? "border border-[#bad4ff] bg-[#f0f6ff] text-[#145be7]"
                  : "border border-transparent bg-transparent text-[#7d8aa0] hover:bg-[rgba(239,246,255,.75)] hover:text-[#405069]",
              )}
              data-category={category}
              key={category}
              role="tab"
              type="button"
              onClick={() => handleSelect(category)}
            >
              {t(category)}
              <span className="ml-1.5 tabular-nums opacity-80">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
