"use client";

import {
  BriefcaseBusiness,
  Calculator,
  Eye,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { IconTile } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";
import type { Tone } from "@/mocks/dashboard/types";

import type { Role } from "../types";
import { ScopeBadge } from "./scope-badge";

const roleVisual: Record<string, { icon: LucideIcon; tone: Tone }> = {
  "tenant-admin": { icon: Shield, tone: "purple" },
  "business-owner": { icon: BriefcaseBusiness, tone: "blue" },
  accountant: { icon: Calculator, tone: "green" },
  sales: { icon: UserRound, tone: "orange" },
  viewer: { icon: Eye, tone: "slate" },
};

export function RoleSummary({
  roles,
  selectedRoleId,
  onSelect,
}: {
  roles: Role[];
  selectedRoleId: string;
  onSelect: (roleId: string) => void;
}) {
  const t = useTranslations("usersPermissions");

  return (
    <section
      aria-labelledby="role-summary-title"
      className="dashboard-card dashboard-enter flex min-w-0 flex-col p-3.5"
    >
      <h3 className="dashboard-card-title" id="role-summary-title">
        {t("roles.summaryTitle")}
      </h3>
      <p className="mt-1 text-[12px] leading-5 text-[#7a899e]">{t("roles.summarySubtitle")}</p>

      <div className="mt-3 space-y-1.5" role="radiogroup" aria-label={t("roles.summaryTitle")}>
        {roles.map((role) => {
          const selected = role.id === selectedRoleId;
          const visual = roleVisual[role.id] ?? { icon: Shield, tone: "blue" as Tone };
          return (
            <button
              aria-checked={selected}
              className={cn(
                "flex w-full min-w-0 items-start gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors duration-150",
                selected
                  ? "border-[#b9d0fb] bg-[#f2f6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                  : "border-transparent bg-transparent hover:bg-[#f5f8fc]",
              )}
              key={role.id}
              role="radio"
              type="button"
              onClick={() => onSelect(role.id)}
            >
              <IconTile icon={visual.icon} size="sm" tone={visual.tone} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-[#1b2d47]">
                    {t(role.nameKey)}
                  </span>
                  <ScopeBadge scope={role.defaultScope} />
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-[#7a899e]">
                  {t(role.descriptionKey)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                  selected ? "border-[#044ce2] bg-[#044ce2]" : "border-[#c5d0e0] bg-white",
                )}
              >
                {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
