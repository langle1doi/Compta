"use client";

import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import type { Tone } from "@/mocks/dashboard/types";

import type { DataScope } from "../types";

const scopeTone: Record<DataScope, Tone> = {
  OWN: "orange",
  COMPANY: "blue",
  TENANT: "purple",
};

export function ScopeBadge({
  scope,
  size = "xs",
}: {
  scope: DataScope;
  size?: "xs" | "sm" | "md";
}) {
  const t = useTranslations("usersPermissions");
  return (
    <StatusBadge size={size} tone={scopeTone[scope]}>
      {t(`scope.${scope}`)}
    </StatusBadge>
  );
}
