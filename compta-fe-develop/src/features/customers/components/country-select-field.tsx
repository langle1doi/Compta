"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CountryFlag } from "@/components/compte/country-flag";
import { cn } from "@/lib/utils";

import {
  CUSTOMER_COUNTRIES,
  countryLabel,
  getCountryByCode,
  type CustomerCountryOption,
} from "../countries";

/** Address country picker — closed state shows flag only. */
export function CountrySelectField({
  label,
  valueCode,
  onChange,
  countries = CUSTOMER_COUNTRIES,
  required,
  className,
}: {
  label: string;
  valueCode: string;
  onChange: (country: CustomerCountryOption) => void;
  countries?: CustomerCountryOption[];
  required?: boolean;
  className?: string;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const selected = getCountryByCode(valueCode) ?? countries[0];
  const title = countryLabel(selected?.code, selected?.code ?? "—");

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuBox({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }

    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.(`[data-country-menu="${listId}"]`)) return;
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
      <button
        ref={triggerRef}
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${label}: ${title}`}
        className={cn(
          "soft-input mt-1 flex h-9 w-full items-center justify-between gap-2 rounded-[9px] px-2.5 text-left outline-none focus:ring-[3px] focus:ring-[#044ce2]/20",
          open && "ring-[3px] ring-[#044ce2]/20",
        )}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <CountryFlag className="h-4 w-6" code={selected?.code} title={title} />
        <ChevronDown
          aria-hidden="true"
          className={cn("h-3.5 w-3.5 shrink-0 text-[#7d8aa0] transition-transform", open && "rotate-180")}
        />
      </button>

      {open && menuBox
        ? createPortal(
            <ul
              aria-label={label}
              className="fixed z-[130] max-h-56 overflow-y-auto rounded-[10px] border border-[#e2eaf5] bg-white py-1 shadow-[0_12px_28px_rgba(29,43,68,0.14)]"
              data-country-menu={listId}
              id={listId}
              role="listbox"
              style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
            >
              {countries.map((country) => {
                const active = country.code === selected?.code;
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
                        onChange(country);
                        setOpen(false);
                      }}
                    >
                      <CountryFlag className="h-4 w-6" code={country.code} title={country.name} />
                      <span className="min-w-0 truncate">{country.name}</span>
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
