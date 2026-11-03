"use client";

import type { ReactNode } from "react";

/**
 * Passthrough — do not add an artificial post-navigation delay.
 *
 * Real wait feedback (Turbopack / RSC) is handled by each route's `loading.tsx`
 * via `ContentLoading`. A fixed minMs here stacked on top of compile time and
 * made every page switch feel laggy even after the route was already warm.
 */
export function RouteContentGate({
  children,
}: {
  children: ReactNode;
  /** @deprecated Kept for call-site compatibility; ignored. */
  minMs?: number;
}) {
  return children;
}
