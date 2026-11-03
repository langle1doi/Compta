"use client";

import type { ReactNode } from "react";

import { useCan } from "@/features/settings/can";
import type { PermissionId } from "@/features/settings/types";
import type { ActionItem, ActionLinkKey } from "@/mocks/dashboard/types";

/** An item only shows to someone who can act on it: any of these rights is enough. */
const ACTION_PERMISSIONS: Record<ActionLinkKey, PermissionId[]> = {
  "attention.reconcile": ["payment.manage"],
  "attention.check": ["payment.manage"],
  "attention.approve": ["quote.approve"],
  "attention.follow": ["quote.send"],
  "attention.reply": ["quote.send"],
  "attention.collect": ["payment.create", "payment.manage"],
  "attention.record": ["payment.create"],
};

export function useVisibleActionItems<T extends ActionItem>(
  items: readonly T[],
) {
  const check = useCan();
  return items.filter((item) =>
    ACTION_PERMISSIONS[item.actionKey].some((id) => check(id)),
  );
}

/** Drops the whole card when none of its items apply to this user. */
export function AttentionGate({
  items,
  children,
}: {
  items: readonly ActionItem[];
  children: ReactNode;
}) {
  return useVisibleActionItems(items).length > 0 ? children : null;
}
