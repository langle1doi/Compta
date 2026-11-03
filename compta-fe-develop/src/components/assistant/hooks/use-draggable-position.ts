"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import type { Point } from "../types";

const EDGE = 8;

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function clampPoint(
  point: Point,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  edge = EDGE,
): Point {
  return {
    x: clamp(point.x, edge, viewport.width - size.width - edge),
    y: clamp(point.y, edge, viewport.height - size.height - edge),
  };
}

function subscribeViewport(onStoreChange: () => void) {
  window.addEventListener("resize", onStoreChange);
  window.addEventListener("orientationchange", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("orientationchange", onStoreChange);
  };
}

function getViewportSnapshot() {
  return `${window.innerWidth}x${window.innerHeight}`;
}

export function useViewportSize() {
  const key = useSyncExternalStore(
    subscribeViewport,
    getViewportSnapshot,
    () => "1280x800",
  );
  const [width, height] = key.split("x").map(Number);
  return { width, height };
}

/**
 * Fixed left/top position with viewport reclamping (SPA-session state).
 */
export function useDraggablePosition({
  defaultFactory,
  sizeFallback,
  edge = EDGE,
}: {
  defaultFactory: (viewport: { width: number; height: number }) => Point;
  sizeFallback: { width: number; height: number };
  edge?: number;
}) {
  const viewport = useViewportSize();
  const [point, setPoint] = useState<Point | null>(null);
  const [viewportKey, setViewportKey] = useState(
    `${viewport.width}x${viewport.height}`,
  );

  const nextViewportKey = `${viewport.width}x${viewport.height}`;
  if (nextViewportKey !== viewportKey) {
    setViewportKey(nextViewportKey);
    const base = point ?? defaultFactory(viewport);
    setPoint(clampPoint(base, sizeFallback, viewport, edge));
  }

  const resolved =
    point === null
      ? clampPoint(defaultFactory(viewport), sizeFallback, viewport, edge)
      : clampPoint(point, sizeFallback, viewport, edge);

  const setClamped = useCallback(
    (next: Point | ((prev: Point) => Point)) => {
      setPoint((current) => {
        const base =
          current ??
          clampPoint(defaultFactory(viewport), sizeFallback, viewport, edge);
        const raw = typeof next === "function" ? next(base) : next;
        return clampPoint(raw, sizeFallback, viewport, edge);
      });
    },
    [defaultFactory, edge, sizeFallback, viewport],
  );

  const dragConstraints = {
    left: edge,
    top: edge,
    right: Math.max(edge, viewport.width - sizeFallback.width - edge),
    bottom: Math.max(edge, viewport.height - sizeFallback.height - edge),
  };

  return {
    point: resolved,
    setPoint: setClamped,
    ready: true,
    dragConstraints,
    viewport,
  };
}
