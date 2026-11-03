import { INTEGRATION_CATALOG } from "./catalog";
import type {
  IntegrationConnection,
  IntegrationDefinition,
  IntegrationDisplayStatus,
  IntegrationFilters,
} from "./model";

export function resolveDisplayStatus(
  definition: IntegrationDefinition,
  connection: IntegrationConnection | null,
): IntegrationDisplayStatus {
  if (definition.availability === "coming_soon") return "coming_soon";
  if (!connection || connection.status === "disconnected") return "ready";
  if (connection.status === "attention") return "attention";
  return "connected";
}

export function connectionForDefinition(
  definition: IntegrationDefinition,
  connections: IntegrationConnection[],
  companyId: string,
): IntegrationConnection | null {
  const matches = connections.filter((item) => item.integrationId === definition.id);
  if (definition.scope === "tenant") {
    return matches.find((item) => !item.companyId) ?? matches[0] ?? null;
  }
  return matches.find((item) => item.companyId === companyId) ?? null;
}

export function filterCatalog(
  filters: IntegrationFilters,
  connections: IntegrationConnection[],
  companyId: string,
): IntegrationDefinition[] {
  const query = filters.search.trim().toLowerCase();

  let list = INTEGRATION_CATALOG.filter((item) => {
    if (filters.category !== "all" && item.category !== filters.category) return false;
    if (!query) return true;
    return (
      item.slug.includes(query) ||
      item.nameKey.toLowerCase().includes(query) ||
      item.category.includes(query)
    );
  });

  list = [...list].sort((a, b) => {
    if (filters.sort === "name") {
      return a.slug.localeCompare(b.slug);
    }
    if (filters.sort === "category") {
      return a.category.localeCompare(b.category) || a.slug.localeCompare(b.slug);
    }
    if (filters.sort === "connected_first") {
      const aStatus = resolveDisplayStatus(
        a,
        connectionForDefinition(a, connections, companyId),
      );
      const bStatus = resolveDisplayStatus(
        b,
        connectionForDefinition(b, connections, companyId),
      );
      const rank = (status: IntegrationDisplayStatus) =>
        status === "connected" ? 0 : status === "attention" ? 1 : status === "ready" ? 2 : 3;
      return rank(aStatus) - rank(bStatus) || a.slug.localeCompare(b.slug);
    }
    // recommended
    const ar = a.recommended ? 0 : 1;
    const br = b.recommended ? 0 : 1;
    return ar - br || a.slug.localeCompare(b.slug);
  });

  return list;
}

export function catalogKpis(
  connections: IntegrationConnection[],
  companyId: string,
) {
  let connected = 0;
  let ready = 0;
  let comingSoon = 0;

  for (const item of INTEGRATION_CATALOG) {
    const status = resolveDisplayStatus(
      item,
      connectionForDefinition(item, connections, companyId),
    );
    if (status === "connected" || status === "attention") connected += 1;
    else if (status === "ready") ready += 1;
    else comingSoon += 1;
  }

  return {
    available: INTEGRATION_CATALOG.length,
    connected,
    ready,
    comingSoon,
  };
}

export function categoryCounts(
  connections: IntegrationConnection[],
  companyId: string,
) {
  void connections;
  void companyId;
  const counts: Record<string, number> = { all: INTEGRATION_CATALOG.length };
  for (const item of INTEGRATION_CATALOG) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}
