"use client";

import { useSyncExternalStore } from "react";

import type {
  CustomerProductPrice,
  ProductActivity,
  ProductDraftInput,
  ProductRecord,
  ProductUsageLink,
} from "./model";

export type { ProductDraftInput };
import {
  seedCustomerPrices,
  seedProductActivities,
  seedProducts,
  seedProductUsage,
} from "./seed";

type ProductState = {
  products: ProductRecord[];
  customerPrices: CustomerProductPrice[];
  activities: ProductActivity[];
  usage: ProductUsageLink[];
};

const serverState: ProductState = {
  products: seedProducts,
  customerPrices: seedCustomerPrices,
  activities: seedProductActivities,
  usage: seedProductUsage,
};

let state: ProductState = structuredClone(serverState);
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function stamp() {
  return new Date().toISOString();
}

function appendActivity(
  activities: ProductActivity[],
  item: Omit<ProductActivity, "id"> & { id?: string },
): ProductActivity[] {
  const activity: ProductActivity = {
    ...item,
    id: item.id ?? `pa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  return [activity, ...activities];
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

export function useProducts() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).products;
}

export function useCustomerProductPrices() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).customerPrices;
}

export function useProductActivities() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).activities;
}

export function useProductUsage() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).usage;
}

export function createProduct(input: ProductDraftInput) {
  const code = input.code.trim().toUpperCase();
  if (!code || !input.name.trim()) return { ok: false as const, error: "required" };
  if (input.unitPriceCents < 0 || input.costCents < 0) {
    return { ok: false as const, error: "invalid_amount" };
  }
  if (
    state.products.some(
      (item) => item.companyId === input.companyId && item.code.toUpperCase() === code,
    )
  ) {
    return { ok: false as const, error: "duplicate_code" };
  }

  const now = stamp();
  const actorName = input.actorName ?? "You";
  const product: ProductRecord = {
    id: crypto.randomUUID(),
    companyId: input.companyId,
    code,
    name: input.name.trim(),
    description: input.description.trim(),
    type: input.type,
    unit: input.unit,
    unitPriceCents: input.unitPriceCents,
    costCents: input.costCents,
    vatRate: input.vatRate,
    categoryId: input.categoryId,
    status: input.status,
    iconKey: input.iconKey,
    createdAt: now,
    updatedAt: now,
    createdBy: actorName,
  };

  state = {
    ...state,
    products: [product, ...state.products],
    activities: appendActivity(state.activities, {
      at: now,
      productId: product.id,
      kind: "created",
      actorName,
    }),
  };
  emit();
  return { ok: true as const, product };
}

export function updateProduct(
  productId: string,
  patch: Partial<
    Pick<
      ProductRecord,
      | "name"
      | "description"
      | "code"
      | "type"
      | "unit"
      | "unitPriceCents"
      | "costCents"
      | "vatRate"
      | "categoryId"
      | "status"
      | "iconKey"
    >
  >,
  actorName = "You",
) {
  const current = state.products.find((item) => item.id === productId);
  if (!current) return { ok: false as const, error: "not_found" };

  if (patch.code) {
    const code = patch.code.trim().toUpperCase();
    if (
      state.products.some(
        (item) =>
          item.id !== productId &&
          item.companyId === current.companyId &&
          item.code.toUpperCase() === code,
      )
    ) {
      return { ok: false as const, error: "duplicate_code" };
    }
    patch = { ...patch, code };
  }

  if (
    (patch.unitPriceCents !== undefined && patch.unitPriceCents < 0) ||
    (patch.costCents !== undefined && patch.costCents < 0)
  ) {
    return { ok: false as const, error: "invalid_amount" };
  }

  const now = stamp();
  const next: ProductRecord = {
    ...current,
    ...patch,
    name: patch.name?.trim() ?? current.name,
    description: patch.description?.trim() ?? current.description,
    updatedAt: now,
  };

  let activities = state.activities;
  if (
    patch.unitPriceCents !== undefined &&
    patch.unitPriceCents !== current.unitPriceCents
  ) {
    activities = appendActivity(activities, {
      at: now,
      productId,
      kind: "price_changed",
      actorName,
    });
  } else if (patch.status === "inactive" && current.status !== "inactive") {
    activities = appendActivity(activities, {
      at: now,
      productId,
      kind: "marked_inactive",
      actorName,
    });
  } else if (patch.status === "active" && current.status !== "active") {
    activities = appendActivity(activities, {
      at: now,
      productId,
      kind: "marked_active",
      actorName,
    });
  } else {
    activities = appendActivity(activities, {
      at: now,
      productId,
      kind: "updated",
      actorName,
    });
  }

  state = {
    ...state,
    products: state.products.map((item) => (item.id === productId ? next : item)),
    activities,
  };
  emit();
  return { ok: true as const, product: next };
}

export function upsertCustomerPrice(input: {
  productId: string;
  customerId: string;
  unitPriceCents: number;
  actorName?: string;
  customerName?: string;
}) {
  if (input.unitPriceCents < 0) return { ok: false as const, error: "invalid_amount" };
  const now = stamp();
  const actorName = input.actorName ?? "You";
  const existing = state.customerPrices.find(
    (item) => item.productId === input.productId && item.customerId === input.customerId,
  );

  let customerPrices: CustomerProductPrice[];
  let kind: ProductActivity["kind"];
  if (existing) {
    customerPrices = state.customerPrices.map((item) =>
      item.id === existing.id
        ? { ...item, unitPriceCents: input.unitPriceCents, updatedAt: now }
        : item,
    );
    kind = "customer_price_updated";
  } else {
    customerPrices = [
      {
        id: crypto.randomUUID(),
        productId: input.productId,
        customerId: input.customerId,
        unitPriceCents: input.unitPriceCents,
        createdAt: now,
        updatedAt: now,
      },
      ...state.customerPrices,
    ];
    kind = "customer_price_added";
  }

  state = {
    ...state,
    customerPrices,
    activities: appendActivity(state.activities, {
      at: now,
      productId: input.productId,
      kind,
      actorName,
      description: input.customerName,
    }),
  };
  emit();
  return { ok: true as const };
}

export function removeCustomerPrice(
  priceId: string,
  actorName = "You",
  customerName?: string,
) {
  const existing = state.customerPrices.find((item) => item.id === priceId);
  if (!existing) return { ok: false as const, error: "not_found" };
  const now = stamp();
  state = {
    ...state,
    customerPrices: state.customerPrices.filter((item) => item.id !== priceId),
    activities: appendActivity(state.activities, {
      at: now,
      productId: existing.productId,
      kind: "customer_price_removed",
      actorName,
      description: customerName,
    }),
  };
  emit();
  return { ok: true as const };
}
