"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { useNestedScrollChain } from "@/lib/use-nested-scroll-chain";

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

export function ReportTableScroll({
  children,
  className,
  maxHeightClassName = "max-h-[min(360px,70vh)]",
}: {
  children: ReactNode;
  className?: string;
  maxHeightClassName?: string;
}) {
  const xRef = useRef<HTMLDivElement>(null);
  useNestedScrollChain(xRef);
  const dragRef = useRef<DragState | null>(null);
  const inertiaFrame = useRef<number | null>(null);
  const [canScrollX, setCanScrollX] = useState(false);
  const [dragging, setDragging] = useState(false);

  const stopInertia = useCallback(() => {
    if (inertiaFrame.current !== null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }
  }, []);

  const measureOverflow = useCallback(() => {
    const el = xRef.current;
    if (!el) return;
    setCanScrollX(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    measureOverflow();
    const el = xRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => measureOverflow());
    observer.observe(el);
    return () => {
      observer.disconnect();
      stopInertia();
    };
  }, [measureOverflow, stopInertia]);

  const runInertia = useCallback(
    (initialVelocity: number) => {
      const el = xRef.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      stopInertia();
      let velocity = initialVelocity;
      const step = () => {
        const node = xRef.current;
        if (!node) return;
        node.scrollLeft += velocity;
        velocity *= 0.9;
        if (Math.abs(velocity) > 0.25) {
          inertiaFrame.current = requestAnimationFrame(step);
        } else {
          inertiaFrame.current = null;
        }
      };
      inertiaFrame.current = requestAnimationFrame(step);
    },
    [stopInertia],
  );

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, label")) return;

    const el = xRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;

    stopInertia();
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
    const el = xRef.current;
    if (!drag || !el || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.locked) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      drag.locked = true;
      setDragging(true);
      el.setPointerCapture(event.pointerId);
    }

    el.scrollLeft = drag.startScrollLeft - dx;

    const now = performance.now();
    const dt = Math.max(8, now - drag.lastTime);
    drag.velocity = ((event.clientX - drag.lastX) / dt) * 14;
    drag.lastX = event.clientX;
    drag.lastTime = now;
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = xRef.current;
    if (!drag || !el || event.pointerId !== drag.pointerId) return;

    dragRef.current = null;
    setDragging(false);
    if (drag.locked && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
      runInertia(-drag.velocity);
    }
  }

  return (
    <div
      ref={xRef}
      className={cn(
        "report-table-scroll-x dashboard-scroll dashboard-scroll--chain min-h-0 min-w-0 overflow-auto",
        maxHeightClassName,
        canScrollX && "report-table-scroll-x--pannable",
        dragging && "report-table-scroll-x--dragging",
        className,
      )}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
    >
      {children}
    </div>
  );
}
