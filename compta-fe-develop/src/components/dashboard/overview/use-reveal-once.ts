"use client";

import { useEffect, useRef, useState } from "react";

/** Flips to `true` the first time the element enters the viewport, then stops observing. */
export function useRevealOnce<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, revealed] as const;
}
