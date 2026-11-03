import { ledgerToday } from "@/features/quotes/model";
import { formatMoneyFromCents } from "@/lib/money";

import type { ProductRecord, ProductUsageLink } from "./model";

export type ProductKpis = {
  total: number;
  active: number;
  inactive: number;
  usedThisMonth: number;
  revenueThisMonthCents: number;
  topProductName: string;
  topProductRevenueCents: number;
  topProductUses: number;
};

function isCurrentMonth(isoDate: string) {
  return isoDate.startsWith(ledgerToday.slice(0, 7));
}

export function getProductKpis(
  products: ProductRecord[],
  usage: ProductUsageLink[],
): ProductKpis {
  const active = products.filter((item) => item.status === "active").length;
  const inactive = products.length - active;

  const monthRefs = usage.filter((item) => isCurrentMonth(item.date));
  const usedIds = new Set(monthRefs.map((item) => item.productId));

  const monthInvoices = monthRefs.filter((item) => item.documentKind === "invoice");
  const revenueByProduct = new Map<string, { cents: number; uses: number }>();
  for (const item of monthInvoices) {
    const current = revenueByProduct.get(item.productId) ?? { cents: 0, uses: 0 };
    revenueByProduct.set(item.productId, {
      cents: current.cents + item.amountCents,
      uses: current.uses + 1,
    });
  }

  let topId = "";
  let topCents = 0;
  let topUses = 0;
  for (const [productId, stats] of revenueByProduct) {
    if (stats.cents > topCents) {
      topId = productId;
      topCents = stats.cents;
      topUses = stats.uses;
    }
  }

  const topProduct = products.find((item) => item.id === topId);

  return {
    total: products.length,
    active,
    inactive,
    usedThisMonth: usedIds.size,
    revenueThisMonthCents: [...revenueByProduct.values()].reduce(
      (sum, item) => sum + item.cents,
      0,
    ),
    topProductName: topProduct?.name ?? "—",
    topProductRevenueCents: topCents,
    topProductUses: topUses,
  };
}

export function formatProductMoney(cents: number) {
  return formatMoneyFromCents(cents);
}
