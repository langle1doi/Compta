export type ProductType = "good" | "service";
export type ProductStatus = "active" | "inactive";

export type ProductUnit =
  | "unit"
  | "hour"
  | "day"
  | "month"
  | "year"
  | "m2"
  | "m"
  | "kg"
  | "package";

export type ProductCategoryId =
  | "consulting"
  | "development"
  | "design"
  | "marketing"
  | "electronics"
  | "accessories"
  | "furniture"
  | "training"
  | "support";

export type ProductIconKey =
  | "consulting"
  | "development"
  | "design"
  | "marketing"
  | "electronics"
  | "accessories"
  | "furniture"
  | "training"
  | "support"
  | "generic_good"
  | "generic_service";

export type ProductActivityKind =
  | "created"
  | "updated"
  | "price_changed"
  | "customer_price_added"
  | "customer_price_updated"
  | "customer_price_removed"
  | "marked_inactive"
  | "marked_active";

export type ProductRecord = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string;
  type: ProductType;
  unit: ProductUnit;
  unitPriceCents: number;
  costCents: number;
  vatRate: number;
  categoryId: ProductCategoryId;
  status: ProductStatus;
  iconKey: ProductIconKey;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type CustomerProductPrice = {
  id: string;
  productId: string;
  customerId: string;
  unitPriceCents: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductActivity = {
  id: string;
  productId: string;
  at: string;
  kind: ProductActivityKind;
  actorName: string;
  description?: string;
};

/** Mock usage link — documents store their own copied unit price. */
export type ProductUsageLink = {
  id: string;
  productId: string;
  documentKind: "quote" | "invoice";
  documentId: string;
  documentNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  status: string;
};

export type ProductTabFilter = "all" | "good" | "service" | "inactive";

export type ProductSortPreset =
  | "nameAsc"
  | "nameDesc"
  | "newest"
  | "priceHigh"
  | "priceLow"
  | "mostUsed";

export type ProductFilters = {
  query: string;
  tab: ProductTabFilter;
  type: ProductType | "all";
  status: ProductStatus | "all";
  categoryId: ProductCategoryId | "all";
};

export const emptyProductFilters: ProductFilters = {
  query: "",
  tab: "all",
  type: "all",
  status: "all",
  categoryId: "all",
};

export const PRODUCT_UNITS: ProductUnit[] = [
  "unit",
  "hour",
  "day",
  "month",
  "year",
  "m2",
  "m",
  "kg",
  "package",
];

export const PRODUCT_VAT_RATES = [20, 10, 5.5, 0] as const;

export const PRODUCT_CATEGORIES: ProductCategoryId[] = [
  "consulting",
  "development",
  "design",
  "marketing",
  "electronics",
  "accessories",
  "furniture",
  "training",
  "support",
];

export function marginCents(product: ProductRecord) {
  return product.unitPriceCents - product.costCents;
}

export function marginRatio(product: ProductRecord) {
  if (product.unitPriceCents <= 0) return 0;
  return marginCents(product) / product.unitPriceCents;
}

export function effectiveUnitPriceCents(
  product: ProductRecord,
  customerId: string | null | undefined,
  prices: CustomerProductPrice[],
) {
  if (!customerId) return product.unitPriceCents;
  const match = prices.find(
    (item) => item.productId === product.id && item.customerId === customerId,
  );
  return match?.unitPriceCents ?? product.unitPriceCents;
}

export type ProductDraftInput = {
  companyId: string;
  code: string;
  name: string;
  description: string;
  type: ProductType;
  unit: ProductUnit;
  unitPriceCents: number;
  costCents: number;
  vatRate: number;
  categoryId: ProductCategoryId;
  status: ProductStatus;
  iconKey: ProductIconKey;
  actorName?: string;
};
