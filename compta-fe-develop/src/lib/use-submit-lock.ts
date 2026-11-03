"use client";

import { useCallback, useRef } from "react";

/**
 * Runs one task at a time. A mutation's isPending only updates after a tick, so disabling the
 * button on it still lets the second click of a double click through.
 */
export function useSubmitLock() {
  const busy = useRef(false);

  return useCallback(async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await task();
    } finally {
      busy.current = false;
    }
  }, []);
}
