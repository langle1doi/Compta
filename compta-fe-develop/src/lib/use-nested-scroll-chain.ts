"use client";

import { useEffect, type RefObject } from "react";

function isScrollableY(element: HTMLElement) {
  const { overflowY } = getComputedStyle(element);
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") {
    return false;
  }
  return element.scrollHeight > element.clientHeight + 1;
}

function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let current = start?.parentElement ?? null;
  while (current) {
    if (isScrollableY(current)) return current;
    current = current.parentElement;
  }
  const root = document.scrollingElement;
  return root instanceof HTMLElement ? root : null;
}

/**
 * When a nested list is scrolled past its top/bottom edge, continue scrolling
 * the nearest page/parent scroller (mouse wheel + trackpad).
 */
export function useNestedScrollChain(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    function onWheel(event: WheelEvent) {
      if (!el || event.ctrlKey || event.defaultPrevented) return;
      // Only multi-list pages opt in; standalone registers and dialogs keep containment.
      if (!el.closest('[data-scroll-chain-page="true"]') || el.closest('[role="dialog"]')) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1;
      const delta = event.deltaY * unit;
      if (delta === 0) return;

      const max = el.scrollHeight - el.clientHeight;
      const atTop = el.scrollTop <= 0;
      const atBottom = max <= 0 || el.scrollTop >= max - 1;
      const passUp = delta < 0 && atTop;
      const passDown = delta > 0 && atBottom;
      if (!passUp && !passDown) return;

      const parent = findScrollParent(el);
      if (!parent || parent === el) return;

      parent.scrollTop += delta;
      event.preventDefault();
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [enabled, ref]);
}
