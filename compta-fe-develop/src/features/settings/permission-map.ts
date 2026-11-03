import type { DataScope, PermissionId } from "./types";

export type BackendGrant = {
  resource: string;
  action: string;
  scope: DataScope;
};

/**
 * The only translation between backend permission codes (modules/rbac/permission-catalog.ts)
 * and frontend PermissionIds. An id missing from every list below is never granted.
 */
export const BACKEND_TO_FRONTEND: Record<string, PermissionId[]> = {
  "company.read": ["company.read"],
  "company.manage": [
    "company.create",
    "company.update",
    "company.archive",
    "company.manage",
  ],
  "settings.manage": [
    "template.email.read",
    "template.email.manage",
    "template.pdf.read",
    "template.pdf.manage",
  ],
  "user.manage": ["user.read", "user.invite", "user.update", "user.disable"],
  "role.manage": ["role.read", "role.manage"],
  "bank.connect": ["bank.read", "bank.manage"],
  "dashboard.view": ["dashboard.view"],
  "customer.read": ["customer.read"],
  "customer.write": ["customer.create", "customer.update"],
  "customer.delete": ["customer.delete"],
  "product.read": ["product.read"],
  "product.manage": ["product.create", "product.update"],
  "quote.read": ["quote.read"],
  "quote.write": ["quote.create", "quote.update", "quote.send"],
  "quote.approve": ["quote.approve"],
  "invoice.read": ["invoice.read"],
  "invoice.request": ["invoice.request"],
  "invoice.create": ["invoice.create"],
  "invoice.validate": ["invoice.validate"],
  "credit_note.create": ["credit_note.create"],
  "payment.record": ["payment.read", "payment.create"],
  "payment.reconcile": ["payment.read", "payment.manage"],
  "report.view": ["report.read"],
  // Accounting export only: CSV lists follow the read permission of their own screen.
  "export.fec": ["report.export"],
  "audit.view": ["audit.read"],
  "ai.use": ["ai.use"],
};

const SCOPE_RANK: Record<DataScope, number> = { OWN: 1, COMPANY: 2, TENANT: 3 };

export function widestScope(a: DataScope | undefined, b: DataScope): DataScope {
  return a && SCOPE_RANK[a] >= SCOPE_RANK[b] ? a : b;
}

export function scopeAtLeast(scope: DataScope | undefined, minimum: DataScope) {
  return scope !== undefined && SCOPE_RANK[scope] >= SCOPE_RANK[minimum];
}

/** Frontend permissions granted by a set of backend grants, each with its widest scope. */
export function grantsToScopes(grants: readonly BackendGrant[]) {
  const scopes = new Map<PermissionId, DataScope>();
  for (const grant of grants) {
    for (const permission of BACKEND_TO_FRONTEND[
      `${grant.resource}.${grant.action}`
    ] ?? []) {
      scopes.set(permission, widestScope(scopes.get(permission), grant.scope));
    }
  }
  return scopes;
}

/** Backend code behind a frontend permission, or undefined when the backend has no equivalent. */
export function backendCodeFor(permission: PermissionId) {
  return Object.entries(BACKEND_TO_FRONTEND).find(([, ids]) =>
    ids.includes(permission),
  )?.[0];
}
