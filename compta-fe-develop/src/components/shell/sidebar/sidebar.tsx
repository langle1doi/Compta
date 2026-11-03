"use client";

import { Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

import { useCommand } from "@/components/command/command-palette";
import { cn } from "@/lib/utils";

import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  useSidebar,
} from "./sidebar-context";

export function Sidebar({
  children,
  animate,
  open,
  setOpen,
}: {
  children: ReactNode;
  animate?: boolean;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}) {
  void animate;
  void open;
  void setOpen;
  return <>{children}</>;
}

export function SidebarBody({
  children,
  className,
  closeLabel,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  "aria-label"?: string;
}) {
  const { isDesktop } = useSidebar();
  const mounted = useIsClient();

  // One nav tree at a time to avoid duplicate layoutIds / switcher state.
  const showDesktopTree = !mounted || isDesktop;

  return (
    <>
      <DesktopSidebar aria-label={ariaLabel} className={className}>
        {showDesktopTree ? children : null}
      </DesktopSidebar>
      {mounted && !isDesktop ? (
        <MobileSidebar
          aria-label={ariaLabel}
          className={className}
          closeLabel={closeLabel}
        >
          {children}
        </MobileSidebar>
      ) : null}
    </>
  );
}

export function DesktopSidebar({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const { open, animate } = useSidebar();
  const reduceMotion = useReducedMotion();
  const instant = reduceMotion === true || !animate;

  return (
    <motion.aside
      aria-label={ariaLabel}
      className={cn(
        "nav-rail relative z-40 hidden shrink-0 flex-col lg:flex",
        open
          ? "h-full overflow-x-hidden border-r border-[#d1d5db] px-3 py-5"
          : "nav-rail--collapsed my-2 ml-2 h-[calc(100%-1rem)] overflow-visible rounded-[16px] border border-[#e4ecf6] px-2 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(37,99,235,0.07)]",
        className,
      )}
      initial={false}
      animate={{
        width: open ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
      }}
      transition={{
        duration: instant ? 0.01 : 0.24,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.aside>
  );
}

export function MobileSidebar({
  children,
  className,
  closeLabel = "Close navigation",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  "aria-label"?: string;
}) {
  const { open, setOpen, animate, triggerRef } = useSidebar();
  const reduceMotion = useReducedMotion();
  const instant = reduceMotion === true || !animate;
  const portalReady = useIsClient();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, triggerRef]);

  if (!portalReady) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[49] flex lg:hidden" key="mobile-sidebar">
          <motion.button
            aria-label={closeLabel}
            className="absolute inset-0 cursor-default bg-[rgb(10_30_64/0.32)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: instant ? 0.01 : 0.2, ease: "easeOut" }}
            type="button"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
          />
          <motion.aside
            aria-label={ariaLabel}
            aria-modal="true"
            className={cn(
              "nav-rail relative z-10 flex h-full w-[min(320px,88vw)] shrink-0 flex-col overflow-hidden border-r border-[#d1d5db] px-4 py-5 shadow-[var(--shadow-overlay)]",
              className,
            )}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            id="app-nav-drawer"
            role="dialog"
            transition={{ duration: instant ? 0.01 : 0.24, ease: "easeOut" }}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a[href]")) {
                setOpen(false);
              }
            }}
          >
            <button
              aria-label={closeLabel}
              className="soft-button absolute top-3.5 right-3 z-20 grid h-10 w-10 place-items-center rounded-[10px] text-[#506078]"
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
            {children}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function SidebarTrigger({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children: ReactNode;
}) {
  const { open, setOpen, triggerRef } = useSidebar();

  return (
    <button
      aria-controls="app-nav-drawer"
      aria-expanded={open}
      aria-label={label}
      className={className}
      ref={triggerRef}
      type="button"
      onClick={() => setOpen(true)}
    >
      {children}
    </button>
  );
}

export function SidebarSearch({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const { setOpen } = useSidebar();
  const { openCommand } = useCommand();

  return (
    <button
      className={cn(
        "soft-input flex min-h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm text-[#7b8798]",
        className,
      )}
      type="button"
      onClick={() => {
        setOpen(false);
        openCommand();
      }}
    >
      <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
