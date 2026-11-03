"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CountryFlag } from "@/components/compte/country-flag";
import { cn } from "@/lib/utils";

import {
  CUSTOMER_COUNTRIES,
  composePhone,
  getCountryByCode,
  parsePhoneValue,
  sanitizeNationalPhone,
} from "../countries";

/** Phone field with flag country / dial-code picker (Soft UI). */
export function PhoneInputField({
  label,
  value,
  onChange,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const parsed = useMemo(() => parsePhoneValue(value), [value]);
  const selected = getCountryByCode(parsed.code) ?? CUSTOMER_COUNTRIES[0];

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuBox({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 240),
      });
    }

    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.(`[data-phone-menu="${listId}"]`)) return;
      setOpen(false);
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, listId]);

  return (
    <label className={cn("block min-w-0", className)}>
      <span className="text-[11px] font-medium text-[#7d8aa0]">
        {label}
        {required ? <span className="text-[#d1492a]"> *</span> : null}
      </span>
      <div className="soft-input mt-1 flex h-9 min-w-0 items-stretch overflow-hidden rounded-[9px] focus-within:ring-[3px] focus-within:ring-[#044ce2]/20">
        <button
          ref={triggerRef}
          aria-controls={listId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`${label}: ${selected.name} ${selected.dial}`}
          className="flex shrink-0 items-center gap-1.5 border-r border-[#e2eaf5] bg-[#f7faff] px-2 outline-none"
          type="button"
          onClick={() => setOpen((next) => !next)}
        >
          <CountryFlag className="h-3.5 w-5" code={selected.code} title={selected.name} />
          <span className="text-[11px] font-semibold text-[#405069]">{selected.dial}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-3 w-3 shrink-0 text-[#7d8aa0] transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <input
          className="min-w-0 flex-1 bg-transparent px-2.5 text-xs text-[#24334c] outline-none"
          inputMode="tel"
          value={sanitizeNationalPhone(parsed.national)}
          onChange={(event) =>
            onChange(composePhone(selected.code, sanitizeNationalPhone(event.target.value)))
          }
        />
      </div>

      {open && menuBox
        ? createPortal(
            <ul
              aria-label={label}
              className="fixed z-[130] max-h-56 overflow-y-auto rounded-[10px] border border-[#e2eaf5] bg-white py-1 shadow-[0_12px_28px_rgba(29,43,68,0.14)]"
              data-phone-menu={listId}
              id={listId}
              role="listbox"
              style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
            >
              {CUSTOMER_COUNTRIES.map((country) => {
                const active = country.code === selected.code;
                return (
                  <li key={country.code} role="none">
                    <button
                      aria-selected={active}
                      className={cn(
                        "flex min-h-9 w-full items-center gap-2.5 px-2.5 text-left text-[12px] font-medium",
                        active ? "bg-[#eef4ff] text-[#044ce2]" : "text-[#24334c] hover:bg-[#f5f8fd]",
                      )}
                      role="option"
                      type="button"
                      onClick={() => {
                        onChange(composePhone(country.code, parsed.national));
                        setOpen(false);
                      }}
                    >
                      <CountryFlag className="h-4 w-6" code={country.code} title={country.name} />
                      <span className="w-12 shrink-0 font-semibold">{country.dial}</span>
                      <span className="min-w-0 truncate text-[#66758d]">{country.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </label>
  );
}
