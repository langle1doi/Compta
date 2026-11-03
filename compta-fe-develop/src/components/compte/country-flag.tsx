"use client";

import { hasFlag } from "country-flag-icons";
import * as FlagSvgs from "country-flag-icons/string/3x2";

import { cn } from "@/lib/utils";

function flagSvg(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized || !hasFlag(normalized)) return null;
  const svg = (FlagSvgs as Record<string, string | undefined>)[normalized];
  return svg ?? null;
}

/** Soft-UI country flag from ISO-3166 alpha-2 via `country-flag-icons`. */
export function CountryFlag({
  code,
  title,
  className,
}: {
  code?: string | null;
  title?: string;
  className?: string;
}) {
  const svg = code ? flagSvg(code) : null;

  if (!svg) {
    return (
      <span
        aria-hidden={!title}
        aria-label={title}
        className={cn(
          "inline-flex h-3.5 w-5 shrink-0 items-center justify-center rounded-[2px] bg-[#e8eef6] text-[8px] font-semibold text-[#7d8aa0]",
          className,
        )}
        title={title}
      >
        {code?.trim().toUpperCase().slice(0, 2) || "—"}
      </span>
    );
  }

  return (
    <span
      aria-hidden={!title}
      aria-label={title}
      className={cn(
        "inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgb(29_43_68/0.08)] [&_svg]:h-full [&_svg]:w-full",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
      title={title}
    />
  );
}
