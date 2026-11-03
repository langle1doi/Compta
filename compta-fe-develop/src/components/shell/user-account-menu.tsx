"use client";

import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { useSession } from "@/features/settings/session-provider";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  // Full navigation so nothing of this session stays in memory.
  window.location.assign(`/${window.location.pathname.split("/")[1] || "fr"}/login`);
}

export function UserAccountMenu() {
  const t = useTranslations("header");
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { user, roleLabel } = useSession();
  const currentUser = {
    name: user?.full_name ?? "",
    email: user?.email ?? "",
    initials: user ? initialsOf(user.full_name) : "",
    roleLabel,
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("accountMenu", { name: currentUser.name })}
        className="action-motion soft-button inline-flex h-10 max-w-[11rem] items-center gap-2 rounded-[10px] px-1.5 pr-2 text-[#405069] sm:max-w-none sm:pr-2.5"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#eaf1ff,#dce8ff)] text-[11px] font-semibold text-[#1857d7] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          {currentUser.initials}
        </span>
        <span className="hidden min-w-0 flex-col items-start leading-tight lg:flex">
          <span className="max-w-[8.5rem] truncate text-xs font-semibold text-[#24334c]">
            {currentUser.name}
          </span>
          <span className="max-w-[8.5rem] truncate text-[10px] text-[#7d8aa0]">
            {currentUser.roleLabel}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "hidden h-3.5 w-3.5 shrink-0 text-[#7d8aa0] transition-transform duration-150 lg:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          className="absolute top-[calc(100%+6px)] right-0 z-50 w-[240px] overflow-hidden rounded-[12px] border border-white/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(241,246,252,0.94))] p-1.5 shadow-[6px_12px_28px_rgba(78,108,145,0.14),-2px_-2px_10px_rgba(255,255,255,0.8)] backdrop-blur-md"
          id={menuId}
          role="menu"
        >
          <div className="rounded-[9px] px-2.5 py-2.5">
            <p className="truncate text-sm font-semibold text-[#24334c]">{currentUser.name}</p>
            <p className="truncate text-xs text-[#7d8aa0]">{currentUser.email}</p>
            <p className="mt-1 text-[10px] font-medium tracking-wide text-[#044ce2] uppercase">
              {currentUser.roleLabel}
            </p>
          </div>

          <div className="my-1 h-px bg-[#e5edf7]" />

          <Link
            className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm text-[#405069] transition-colors duration-150 hover:bg-white/80 hover:text-[#24334c]"
            href="/parametres"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <Settings aria-hidden="true" className="h-4 w-4 text-[#044ce2]" />
            {t("accountSettings")}
          </Link>

          <button
            className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm text-[#405069] transition-colors duration-150 hover:bg-white/80 hover:text-[#24334c]"
            onClick={() => setOpen(false)}
            role="menuitem"
            type="button"
          >
            <UserRound aria-hidden="true" className="h-4 w-4 text-[#044ce2]" />
            {t("accountProfile")}
          </button>

          <div className="my-1 h-px bg-[#e5edf7]" />

          <button
            className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm text-[#b42318] transition-colors duration-150 hover:bg-[#fff1f0]"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            role="menuitem"
            type="button"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            {t("signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
