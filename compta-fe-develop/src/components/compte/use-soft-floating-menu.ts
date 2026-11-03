"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import { useOutsideDismiss } from "@/lib/use-outside-dismiss";

export const SOFT_MENU_OPEN_EVENT = "compte:soft-select-open";
const MENU_GAP = 4;
const MENU_EDGE = 8;

export type SoftMenuBox = {
  top: number;
  left: number;
  width: number;
};

/**
 * Shared open/position/dismiss behavior for SoftDatePicker and SoftTimePicker.
 */
export function useSoftFloatingMenu({
  menuHeight,
  minWidth,
}: {
  menuHeight: number;
  minWidth: number;
}) {
  const instanceId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<SoftMenuBox | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const dismissRoots = useMemo(
    () => [rootRef, menuRef] as Array<RefObject<HTMLElement | null>>,
    [],
  );

  function openMenu() {
    setOpen(true);
    window.dispatchEvent(
      new CustomEvent(SOFT_MENU_OPEN_EVENT, { detail: { id: instanceId } }),
    );
  }

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, minWidth);
      const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - MENU_EDGE;
      const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;
      const maxLeft = Math.max(MENU_EDGE, window.innerWidth - width - MENU_EDGE);
      setMenuBox({
        top: openUp
          ? Math.max(MENU_EDGE, rect.top - menuHeight - MENU_GAP)
          : rect.bottom + MENU_GAP,
        left: Math.min(Math.max(MENU_EDGE, rect.left), maxLeft),
        width,
      });
    }

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuHeight, minWidth, open]);

  useOutsideDismiss({
    active: open,
    onDismiss: close,
    roots: dismissRoots,
  });

  useLayoutEffect(() => {
    if (!open) return;

    function onOtherOpen(event: Event) {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== instanceId) close();
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    window.addEventListener(SOFT_MENU_OPEN_EVENT, onOtherOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(SOFT_MENU_OPEN_EVENT, onOtherOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, instanceId, open]);

  return {
    open,
    menuBox,
    rootRef,
    triggerRef,
    menuRef,
    openMenu,
    close,
    toggle() {
      if (open) {
        close();
        return;
      }
      openMenu();
    },
  };
}
