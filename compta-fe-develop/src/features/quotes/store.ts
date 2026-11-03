"use client";

import { useSyncExternalStore } from "react";

import { owners, seedCustomers, seedQuotes } from "./seed";
import type { CustomerRecord, QuoteRecord, SavedView } from "./model";

type LedgerState = {
  quotes: QuoteRecord[];
  customers: CustomerRecord[];
  customViews: SavedView[];
};

const serverState: LedgerState = {
  quotes: seedQuotes,
  customers: seedCustomers,
  customViews: [],
};

let state = serverState;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Ephemeral mock ledger — no persistence; F5 restores seed. */
export function hydrateLedger() {
  if (typeof window === "undefined" || hydrated) return;
  hydrated = true;
  window.sessionStorage.removeItem("compte.quote-ledger");
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return serverState;
}

export function useLedger() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useHydrated() {
  return useSyncExternalStore(subscribe, () => hydrated, () => false);
}

export function addCustomer(name: string) {
  const id = `customer-${Date.now()}`;
  const customer = { id, name: name.trim() };
  state = { ...state, customers: [customer, ...state.customers] };
  emit();
  return customer;
}

/** Upsert a CRM customer into the quote ledger so cross-module links resolve. */
export function ensureCustomer(input: { id: string; name: string }) {
  const name = input.name.trim() || input.id;
  const existing = state.customers.find((customer) => customer.id === input.id);
  if (existing) {
    if (existing.name === name) return existing;
    const next = { ...existing, name };
    state = {
      ...state,
      customers: state.customers.map((customer) =>
        customer.id === input.id ? next : customer,
      ),
    };
    emit();
    return next;
  }
  const customer = { id: input.id, name };
  state = { ...state, customers: [customer, ...state.customers] };
  emit();
  return customer;
}

export function addQuote(input: {
  customerId: string;
  ownerId: string;
  validUntil: string;
}) {
  const numeric = state.quotes.reduce((max, quote) => {
    const value = Number(quote.id.replace(/\D/g, ""));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 20260100);
  const id = `DEV${numeric + 1}`;
  const quote: QuoteRecord = {
    id,
    customerId: input.customerId,
    workKey: "work.consulting",
    ownerId: input.ownerId,
    status: "draft",
    validUntil: input.validUntil,
    vatRate: 20,
    lines: [],
    createdAt: "2026-10-02",
    activity: [
      {
        id: `${id}-created`,
        at: "2026-10-02",
        messageKey: "activity.quoteCreated",
        values: {
          name: owners.find((owner) => owner.id === input.ownerId)?.name ?? "",
          id,
        },
      },
    ],
  };
  state = { ...state, quotes: [quote, ...state.quotes] };
  emit();
  return quote;
}

export function updateQuote(id: string, patch: Partial<QuoteRecord>) {
  state = {
    ...state,
    quotes: state.quotes.map((quote) => (quote.id === id ? { ...quote, ...patch } : quote)),
  };
  emit();
}

export function insertQuote(quote: QuoteRecord) {
  if (state.quotes.some((item) => item.id === quote.id)) return;
  state = { ...state, quotes: [quote, ...state.quotes] };
  emit();
}

export function removeQuote(id: string) {
  state = { ...state, quotes: state.quotes.filter((quote) => quote.id !== id) };
  emit();
}

export function saveCustomView(view: SavedView) {
  state = { ...state, customViews: [view, ...state.customViews.filter((item) => item.id !== view.id)] };
  emit();
}

export function restoreSeed() {
  state = {
    quotes: seedQuotes,
    customers: seedCustomers,
    customViews: [],
  };
  emit();
}
