import { compareCodeUnits } from '../../common/text/compare-code-units';

/** What the frontend needs to show or hide things. Only for display: the guards enforce on the server. */
export interface PermissionView {
  resource: string;
  action: string;
  scope: string | null;
}

export interface ModuleView {
  module: string;
  scope: string | null;
  visible: boolean;
  actions: { read: boolean; create: boolean; update: boolean; delete: boolean };
  specialized: string[];
}

const SCOPE_RANK: Record<string, number> = { OWN: 1, COMPANY: 2, TENANT: 3 };

const READ_ACTIONS = new Set(['read', 'view', 'manage']);
const CREATE_ACTIONS = new Set(['create', 'write', 'manage']);
const UPDATE_ACTIONS = new Set(['update', 'write', 'manage']);
const DELETE_ACTIONS = new Set(['delete', 'manage']);
const CRUD_ACTIONS = new Set([...READ_ACTIONS, ...CREATE_ACTIONS, ...UPDATE_ACTIONS, ...DELETE_ACTIONS]);

/** Widest scope per (resource, action), across every membership that applies. */
export function mergeGrants(grants: PermissionView[]): PermissionView[] {
  const merged = new Map<string, PermissionView>();
  for (const grant of grants) {
    const key = `${grant.resource}.${grant.action}`;
    const known = merged.get(key);
    if (!known || (SCOPE_RANK[grant.scope ?? ''] ?? 0) > (SCOPE_RANK[known.scope ?? ''] ?? 0)) merged.set(key, grant);
  }
  return [...merged.values()].sort((a, b) => `${a.resource}.${a.action}`.localeCompare(`${b.resource}.${b.action}`));
}

/**
 * A module is visible only with READ. The modules of the catalog that have no read-type permission at all
 * (payment.record, bank.connect, export.fec, ...) count any grant as READ: the permission codes stay as they are.
 */
export function buildModules(grants: PermissionView[], catalog: { resource: string; action: string }[]): ModuleView[] {
  const modules = [...new Set(catalog.map((p) => p.resource))].sort(compareCodeUnits);
  return modules.map((module) => {
    const own = grants.filter((g) => g.resource === module);
    const has = (set: Set<string>) => own.some((g) => set.has(g.action));
    const hasReadType = catalog.some((p) => p.resource === module && READ_ACTIONS.has(p.action));
    const read = has(READ_ACTIONS) || (!hasReadType && own.length > 0);
    const widest = own.reduce<string | null>((w, g) => ((SCOPE_RANK[g.scope ?? ''] ?? 0) > (SCOPE_RANK[w ?? ''] ?? 0) ? g.scope : w), null);
    return {
      module,
      scope: widest,
      visible: read,
      actions: { read, create: has(CREATE_ACTIONS), update: has(UPDATE_ACTIONS), delete: has(DELETE_ACTIONS) },
      specialized: own
        .filter((g) => !CRUD_ACTIONS.has(g.action))
        .map((g) => g.action)
        .sort(compareCodeUnits),
    };
  });
}
