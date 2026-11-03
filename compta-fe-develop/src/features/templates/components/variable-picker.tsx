"use client";

import { Braces, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useOutsideDismiss } from "@/lib/use-outside-dismiss";

import { TEMPLATE_VARIABLES, type TemplateVariable } from "../variables";

const GROUPS: TemplateVariable["group"][] = [
  "company",
  "customer",
  "quote",
  "invoice",
  "payment",
  "dates",
];

export function VariablePicker({
  onInsert,
  label = "Add variable",
}: {
  onInsert: (token: string) => void;
  label?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  useOutsideDismiss({
    active: open,
    roots: [rootRef, menuRef],
    onDismiss: () => setOpen(false),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEMPLATE_VARIABLES;
    return TEMPLATE_VARIABLES.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    );
  }, [query]);

  function openMenu() {
    const trigger = rootRef.current?.querySelector("button");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setBox({
      top: Math.min(rect.bottom + 4, window.innerHeight - 320),
      left: Math.min(rect.left, window.innerWidth - 288),
    });
    setOpen(true);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="action-motion soft-button inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#405069]"
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <Braces aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[120] flex h-[300px] w-[280px] flex-col overflow-hidden rounded-[12px] border border-[#e1e7f1] bg-white shadow-[0_12px_28px_rgba(29,43,68,0.14)]"
              style={
                box
                  ? { top: box.top, left: box.left }
                  : { top: -9999, left: -9999 }
              }
            >
              <div className="relative border-b border-[#e8eef7] p-2">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4 h-3.5 w-3.5 -translate-y-1/2 text-[#98a4b5]"
                />
                <input
                  autoFocus
                  className="soft-input h-8 w-full rounded-[8px] pr-2 pl-8 text-xs"
                  placeholder="Search variables…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                {GROUPS.map((group) => {
                  const items = filtered.filter((item) => item.group === group);
                  if (items.length === 0) return null;
                  return (
                    <div className="mb-1" key={group}>
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
                        {group}
                      </p>
                      {items.map((item) => (
                        <button
                          className="flex w-full flex-col rounded-[8px] px-2 py-1.5 text-left hover:bg-[#f4f8ff]"
                          key={item.key}
                          type="button"
                          onClick={() => {
                            onInsert(`{{${item.key}}}`);
                            setOpen(false);
                            setQuery("");
                          }}
                        >
                          <span className="text-[12px] font-medium text-[#24334c]">
                            {item.label}
                          </span>
                          <span className="font-mono text-[10px] text-[#7d8aa0]">
                            {`{{${item.key}}}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
                {filtered.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-[#98a4b5]">
                    No variables found
                  </p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function insertAtCursor(
  current: string,
  token: string,
  element: HTMLTextAreaElement | HTMLInputElement | null,
) {
  if (!element) return current + token;
  const start = element.selectionStart ?? current.length;
  const end = element.selectionEnd ?? current.length;
  const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
  requestAnimationFrame(() => {
    element.focus();
    const caret = start + token.length;
    element.setSelectionRange(caret, caret);
  });
  return next;
}
