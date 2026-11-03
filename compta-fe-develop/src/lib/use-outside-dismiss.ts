"use client";

import { useEffect, useRef, type RefObject } from "react";

function eventPath(event: Event): EventTarget[] {
  if (typeof event.composedPath === "function") {
    return event.composedPath();
  }
  const path: EventTarget[] = [];
  let node: Node | null = event.target instanceof Node ? event.target : null;
  while (node) {
    path.push(node);
    node = node.parentNode;
  }
  return path;
}

/**
 * Dismiss when the user presses outside any of the given roots (capture phase).
 * Portaled menus should include their portal node/ref in `roots`.
 */
export function useOutsideDismiss({
  active,
  onDismiss,
  roots,
  allowSelector,
}: {
  active: boolean;
  onDismiss: () => void;
  roots: Array<RefObject<Element | null>>;
  /** Keep open when the event path hits an element matching this selector. */
  allowSelector?: string;
}) {
  const onDismissRef = useRef(onDismiss);
  const rootsRef = useRef(roots);
  const allowSelectorRef = useRef(allowSelector);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    rootsRef.current = roots;
    allowSelectorRef.current = allowSelector;
  });

  useEffect(() => {
    if (!active) return;

    function onPointerDown(event: Event) {
      const path = eventPath(event);
      for (const root of rootsRef.current) {
        if (root.current && path.includes(root.current)) return;
      }
      const selector = allowSelectorRef.current;
      if (selector) {
        const hit = path.some(
          (node) => node instanceof Element && Boolean(node.closest(selector)),
        );
        if (hit) return;
      }
      onDismissRef.current();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismissRef.current();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active]);
}
