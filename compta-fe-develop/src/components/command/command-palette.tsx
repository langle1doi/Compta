"use client";

import { useRouter } from "@/i18n/navigation";
import { invoicesToFollow } from "@/mocks/dashboard/invoices-to-follow";
import { hydrateLedger, useLedger } from "@/features/quotes/store";
import { useCan } from "@/features/settings/can";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type CommandItem = {
  id: string;
  group: "actions" | "customers" | "quotes" | "invoices";
  label: string;
  run: () => void;
};

type CommandApi = {
  openCommand: () => void;
};

const CommandContext = createContext<CommandApi>({ openCommand: () => {} });

export function useCommand() {
  return useContext(CommandContext);
}

export function CommandProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hydrateLedger();
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandContext.Provider value={{ openCommand: () => setOpen(true) }}>
      {children}
      {open ? <CommandDialog onClose={() => setOpen(false)} /> : null}
    </CommandContext.Provider>
  );
}

function CommandDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("command");
  const router = useRouter();
  const ledger = useLedger();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const check = useCan();

  const items = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      ...(check("quote.create")
        ? [
            {
              id: "create-quote",
              group: "actions" as const,
              label: t("createQuote"),
              run: () => router.push("/devis?create=1"),
            },
          ]
        : []),
      ...(check("quote.create") && check("customer.create")
        ? [
            {
              id: "create-customer",
              group: "actions" as const,
              label: t("createCustomer"),
              run: () => router.push("/devis?create=1&customer=new"),
            },
          ]
        : []),
    ];
    // These results open the quote register, whatever their type.
    const canOpenRegister = check("quote.read");
    const customers: CommandItem[] = (canOpenRegister && check("customer.read") ? ledger.customers : []).map((customer) => ({
      id: `customer-${customer.id}`,
      group: "customers",
      label: t("openCustomer", { name: customer.name }),
      run: () => router.push(`/devis?customer=${customer.id}`),
    }));
    const quotes: CommandItem[] = (canOpenRegister ? ledger.quotes : []).map((quote) => ({
      id: `quote-${quote.id}`,
      group: "quotes",
      label: t("openQuote", { id: quote.id }),
      run: () => router.push(`/devis?quote=${quote.id}`),
    }));
    const invoices: CommandItem[] = (canOpenRegister && check("invoice.read") ? invoicesToFollow : []).map((invoice) => ({
      id: `invoice-${invoice.id}`,
      group: "invoices",
      label: t("openInvoice", { id: invoice.id }),
      run: () => router.push(`/devis?invoice=${invoice.id}`),
    }));
    return [...actions, ...customers, ...quotes, ...invoices];
  }, [check, ledger.customers, ledger.quotes, router, t]);

  const visible = items.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const current = visible[Math.min(active, Math.max(visible.length - 1, 0))];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const groups = ["actions", "customers", "quotes", "invoices"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#063586]/30 px-4 pt-[12vh]">
      <button
        className="absolute inset-0 cursor-default"
        type="button"
        aria-label={t("close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("label")}
        className="command-pop relative z-10 w-full max-w-[560px] overflow-hidden rounded-[18px] bg-white shadow-[0_22px_70px_rgb(29_43_68/0.18)] ring-1 ring-[#e1e7f1]"
      >
        <input
          ref={inputRef}
          className="h-12 w-full border-b border-[#edf1f6] px-4 text-sm text-[#063586] outline-none placeholder:text-[#7b8798]"
          placeholder={t("placeholder")}
          value={query}
          aria-activedescendant={current ? `command-${current.id}` : undefined}
          aria-controls="command-list"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, visible.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter" && current) {
              current.run();
              onClose();
            }
          }}
        />
        <div id="command-list" role="listbox" className="max-h-[360px] overflow-y-auto p-2">
          {visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[#728097]">{t("empty")}</p>
          ) : (
            groups.map((group) => {
              const groupItems = visible.filter((item) => item.group === group);
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className="mb-2">
                  <p className="px-2 py-1 text-[11px] font-semibold tracking-[0.04em] text-[#8b97a8]">
                    {t(`groups.${group}`)}
                  </p>
                  {groupItems.map((item) => {
                    const index = visible.indexOf(item);
                    const selected = index === active;
                    return (
                      <button
                        id={`command-${item.id}`}
                        key={item.id}
                        role="option"
                        aria-selected={selected}
                        className={`flex min-h-10 w-full items-center rounded-[10px] px-2 text-left text-sm ${
                          selected ? "bg-[#e7efff] text-[#044ce2]" : "text-[#24334c] hover:bg-[#f4f8ff]"
                        }`}
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => {
                          item.run();
                          onClose();
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-[#edf1f6] px-4 py-2 text-[11px] text-[#7b8798]">
          <span>↑ ↓ {t("hint")}</span>
          <span>Enter {t("run")}</span>
          <span>Esc {t("close")}</span>
        </div>
      </div>
    </div>
  );
}

export function CommandSearchIconTrigger({ label, className = "" }: { label: string; className?: string }) {
  const { openCommand } = useCommand();

  return (
    <button
      aria-label={label}
      className={`action-motion soft-button grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[#506078] hover:text-[#044ce2] ${className}`}
      title={label}
      type="button"
      onClick={openCommand}
    >
      <Search aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

export function CommandSearchTrigger({ label }: { label: string }) {
  const { openCommand } = useCommand();

  return (
    <button
      className="action-motion hidden w-full min-w-0 max-w-[420px] items-center gap-2 soft-input rounded-[12px] px-3 py-2 text-left text-sm text-[#7b8798] xl:flex"
      type="button"
      onClick={openCommand}
    >
      <Search className="h-4 w-4" />
      <span className="truncate">{label}</span>
      <kbd className="ml-auto rounded-[5px] border border-[#d8e0ed] bg-white px-1.5 py-0.5 text-[10px] text-[#7b8798]">
        Ctrl K
      </kbd>
    </button>
  );
}
