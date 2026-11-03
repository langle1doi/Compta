"use client";

import { useSyncExternalStore } from "react";

/**
 * @param serverSnapshot — value used during SSR / before hydrate.
 * Prefer `true` for desktop-first shell queries so collapsed width and
 * chrome content stay in sync on first paint (avoids expanded cards
 * jammed into the 76px rail).
 */
export function useMediaQuery(query: string, serverSnapshot = false) {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => serverSnapshot,
  );
}
