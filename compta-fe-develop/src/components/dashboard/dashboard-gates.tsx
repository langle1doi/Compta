"use client";

import type { ReactNode } from "react";

import { useCan } from "@/features/settings/can";
import { useSession } from "@/features/settings/session-provider";
import type { PermissionId } from "@/features/settings/types";

/**
 * A widget summarizing the whole company: an OWN dashboard (Sales, F05 AC-03) does not get it,
 * however much the domain permission allows.
 */
export function CompanyWidget({
  permission,
  children,
}: {
  permission: PermissionId;
  children: ReactNode;
}) {
  const check = useCan();
  if (!check("dashboard.view", "COMPANY") || !check(permission)) return null;
  return children;
}

export function HeroRoleValue() {
  return useSession().roleLabel;
}
