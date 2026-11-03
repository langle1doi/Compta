"use client";

import { useCallback, type ReactNode } from "react";

import { scopeAtLeast } from "./permission-map";
import { permissionsInclude } from "./permissions";
import { useSession } from "./session-provider";
import type { DataScope, PermissionId } from "./types";

type CanProps = {
  permission: PermissionId;
  /** Needed for widgets about the whole company: OWN scope is not enough. */
  minScope?: DataScope;
  children: ReactNode;
  fallback?: ReactNode;
};

/** `can` bound to the session, including the data scope check. */
export function useCan() {
  const { scopes } = useSession();
  return useCallback(
    (permission: PermissionId, minScope?: DataScope) => {
      const scope = scopes.get(permission);
      if (!scope) return false;
      return minScope ? scopeAtLeast(scope, minScope) : true;
    },
    [scopes],
  );
}

/**
 * Permission gate. Prefer this over role-name checks. Renders nothing while permissions load,
 * so gated content never flashes. The backend still decides: this only shapes the display.
 */
export function Can({ permission, minScope, children, fallback = null }: CanProps) {
  const check = useCan();
  if (!check(permission, minScope)) return <>{fallback}</>;
  return <>{children}</>;
}

export function can(permissions: readonly PermissionId[], permission: PermissionId): boolean {
  return permissionsInclude(permissions, permission);
}
