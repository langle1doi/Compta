"use client";

import { MailPlus, Pencil, UserX, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { TeamMember } from "../types";

export function UserActionsMenu({
  member,
  onEdit,
  onDisable,
  onResend,
}: {
  member: TeamMember;
  onEdit?: () => void;
  onDisable?: () => void;
  onResend?: () => void;
}) {
  const t = useTranslations("usersPermissions.userActions");

  const actions: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    danger?: boolean;
    hidden?: boolean;
    onClick?: () => void;
  }> = [
    {
      id: "edit",
      label: t("edit"),
      icon: Pencil,
      onClick: onEdit,
    },
    {
      id: "resendInvitation",
      label: t("resendInvitation"),
      icon: MailPlus,
      hidden: member.status !== "INVITED",
      onClick: onResend,
    },
    {
      id: "disable",
      label: t("disable"),
      icon: UserX,
      danger: true,
      hidden: member.status === "DISABLED",
      onClick: onDisable,
    },
  ];

  const visible = actions.filter((action) => !action.hidden && action.onClick);

  return (
    <div
      aria-label={t("open", { name: member.name })}
      className="inline-flex flex-nowrap items-center justify-end gap-1"
      role="group"
    >
      {visible.map((action) => {
        const Icon = action.icon;
        return (
          <button
            aria-label={`${action.label} · ${member.name}`}
            className={cn(
              "soft-button grid h-9 w-9 shrink-0 place-items-center rounded-[9px] transition-colors",
              action.danger
                ? "text-[#c9564f] hover:bg-[#fff0ed] hover:text-[#b4453f]"
                : "text-[#506078] hover:bg-[#eef4ff] hover:text-[#044ce2]",
            )}
            key={action.id}
            title={action.label}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              action.onClick?.();
            }}
          >
            <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
          </button>
        );
      })}
    </div>
  );
}
