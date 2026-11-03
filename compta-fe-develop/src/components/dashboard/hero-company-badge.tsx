"use client";

import { StatusBadge } from "@/components/dashboard/tone";
import { useSession } from "@/features/settings/session-provider";

export function HeroCompanyBadge() {
  const { company } = useSession();
  if (!company) return null;
  return (
    <StatusBadge size="sm" tone="blue">
      {company.trade_name || company.legal_name}
    </StatusBadge>
  );
}
