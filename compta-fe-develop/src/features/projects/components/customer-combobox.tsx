"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useOutsideDismiss } from "@/lib/use-outside-dismiss";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

export function CustomerCombobox({
  label,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const dismissRoots = useMemo(() => [rootRef, menuRef], []);

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  useOutsideDismiss({
    active: open,
    onDismiss: () => {
      setOpen(false);
      setQuery("");
    },
    roots: dismissRoots,
  });

  function openMenu() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuBox({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    setOpen(true);
  }

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <span className="mb-1 block text-[10px] font-semibold text-[#7d8aa0]">{label}</span>
      <button
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={cn(
          "soft-input flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-[9px] !bg-white px-2.5 text-left text-xs font-semibold text-[#24334c] outline-none",
          open && "ring-1 ring-[#044ce2]/30",
        )}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            setQuery("");
            return;
          }
          openMenu();
        }}
      >
        <span className={cn("min-w-0 truncate", !selected && "font-medium text-[#98a4b5]")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[#7d8aa0] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && menuBox
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[110] overflow-hidden rounded-[10px] border border-[#e2eaf5] bg-white shadow-[0_12px_28px_rgba(29,43,68,0.14)]"
              style={{
                top: menuBox.top,
                left: menuBox.left,
                width: menuBox.width,
              }}
            >
              <div className="flex items-center gap-2 border-b border-[#edf2f8] px-2.5 py-2">
                <Search aria-hidden="true" className="h-3.5 w-3.5 text-[#98a4b5]" />
                <input
                  autoFocus
                  aria-label={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#98a4b5]"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <ul
                className="soft-select-scroll max-h-[220px] overflow-y-auto py-1"
                id={listId}
                role="listbox"
              >
                {filtered.length === 0 ? (
                  <li className="px-2.5 py-3 text-center text-[11px] text-[#98a4b5]">
                    {emptyLabel}
                  </li>
                ) : (
                  filtered.map((option) => {
                    const active = option.value === value;
                    return (
                      <li key={option.value} role="none">
                        <button
                          aria-selected={active}
                          className={cn(
                            "flex min-h-9 w-full items-center justify-between gap-2 px-2.5 text-left text-xs font-medium",
                            active
                              ? "bg-[#eef4ff] text-[#044ce2]"
                              : "text-[#24334c] hover:bg-[#f5f8fd]",
                          )}
                          role="option"
                          type="button"
                          onClick={() => {
                            onChange(option.value);
                            setOpen(false);
                            setQuery("");
                          }}
                        >
                          <span className="min-w-0 truncate">{option.label}</span>
                          {active ? (
                            <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
