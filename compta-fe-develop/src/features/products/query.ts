import type {
  ProductFilters,
  ProductRecord,
  ProductSortPreset,
  ProductUsageLink,
} from "./model";

export function productsForCompany(products: ProductRecord[], companyId: string) {
  return products.filter((item) => item.companyId === companyId);
}

export function matchesProductFilters(product: ProductRecord, filters: ProductFilters) {
  if (filters.tab === "good" && product.type !== "good") return false;
  if (filters.tab === "service" && product.type !== "service") return false;
  if (filters.tab === "inactive" && product.status !== "inactive") return false;
  if (filters.tab === "all" && filters.status === "active" && product.status !== "active") {
    return false;
  }
  if (filters.tab === "all" && filters.status === "inactive" && product.status !== "inactive") {
    return false;
  }

  if (filters.type !== "all" && product.type !== filters.type) return false;
  if (filters.status !== "all" && filters.tab !== "inactive" && product.status !== filters.status) {
    return false;
  }
  if (filters.categoryId !== "all" && product.categoryId !== filters.categoryId) return false;

  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [
      product.name,
      product.code,
      product.description,
      product.categoryId,
      product.unit,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function sortProducts(
  products: ProductRecord[],
  sortPreset: ProductSortPreset = "nameAsc",
  usage: ProductUsageLink[] = [],
) {
  return [...products].sort((left, right) => {
    switch (sortPreset) {
      case "nameDesc":
        return right.name.localeCompare(left.name);
      case "newest":
        return right.updatedAt.localeCompare(left.updatedAt);
      case "priceHigh":
        return right.unitPriceCents - left.unitPriceCents;
      case "priceLow":
        return left.unitPriceCents - right.unitPriceCents;
      case "mostUsed": {
        const leftUses = usageCount(usage, left.id);
        const rightUses = usageCount(usage, right.id);
        if (rightUses !== leftUses) return rightUses - leftUses;
        return left.name.localeCompare(right.name);
      }
      case "nameAsc":
      default:
        if (left.status !== right.status) {
          return left.status === "active" ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
    }
  });
}

export function filterProducts(
  products: ProductRecord[],
  filters: ProductFilters,
  sortPreset: ProductSortPreset = "nameAsc",
  usage: ProductUsageLink[] = [],
) {
  return sortProducts(
    products.filter((item) => matchesProductFilters(item, filters)),
    sortPreset,
    usage,
  );
}

export function usageForProduct(usage: ProductUsageLink[], productId: string) {
  return usage
    .filter((item) => item.productId === productId)
    .sort((left, right) => `${right.date}${right.id}`.localeCompare(`${left.date}${left.id}`));
}

export function usageCount(usage: ProductUsageLink[], productId: string) {
  return usage.filter((item) => item.productId === productId).length;
}

export function tabCounts(products: ProductRecord[]) {
  return {
    all: products.length,
    good: products.filter((item) => item.type === "good").length,
    service: products.filter((item) => item.type === "service").length,
    inactive: products.filter((item) => item.status === "inactive").length,
  };
}
