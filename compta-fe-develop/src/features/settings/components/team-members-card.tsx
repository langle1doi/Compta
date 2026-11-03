"use client";

import { Plus, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import type { Tone } from "@/mocks/dashboard/types";

import type { Company, Role, TeamMember, UserStatus } from "../types";
import { ScopeBadge } from "./scope-badge";
import { UserActionsMenu } from "./user-actions-menu";

const statusTone: Record<UserStatus, Tone> = {
  ACTIVE: "green",
  INVITED: "orange",
  DISABLED: "slate",
};

const roleTone: Record<string, Tone> = {
  "tenant-admin": "purple",
  "business-owner": "blue",
  accountant: "green",
  sales: "orange",
  viewer: "slate",
};

function companyLabel(member: TeamMember, companies: Company[], allLabel: string) {
  if (member.dataScope === "TENANT") return allLabel;
  const names = member.companyIds
    .map((id) => companies.find((company) => company.id === id)?.name)
    .filter(Boolean);
  return names.join(", ") || "—";
}

export function TeamMembersCard({
  members,
  roles,
  companies,
  onInvite,
  onCreateRole,
}: {
  members: TeamMember[];
  roles: Role[];
  companies: Company[];
  onInvite: () => void;
  onCreateRole: () => void;
}) {
  const t = useTranslations("usersPermissions");

  return (
    <section
      aria-labelledby="team-members-title"
      className="dashboard-card dashboard-list dashboard-enter flex min-w-0 flex-col overflow-hidden"
    >
      <div className="dashboard-list__header">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="dashboard-card-title" id="team-members-title">
              {t("team.title")}
            </h3>
            <p className="mt-1 max-w-[58ch] text-[12px] leading-5 text-[#7a899e]">{t("team.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="action-motion soft-button inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
              type="button"
              onClick={onCreateRole}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {t("team.createRole")}
            </button>
            <button
              className="action-motion soft-primary inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-white"
              type="button"
              onClick={onInvite}
            >
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              {t("team.invite")}
            </button>
          </div>
        </div>
      </div>

      <div className="hidden min-w-0 md:block">
        <div className="dashboard-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-0 text-left">
            <thead className="dashboard-list__head">
              <tr>
                <th className="w-[28%]">{t("team.columns.user")}</th>
                <th className="w-[14%]">{t("team.columns.role")}</th>
                <th className="w-[12%]">{t("team.columns.scope")}</th>
                <th className="w-[16%]">{t("team.columns.companies")}</th>
                <th className="w-[12%]">{t("team.columns.status")}</th>
                <th className="w-[12%]">{t("team.columns.activity")}</th>
                <th className="w-[116px] min-w-[116px]">
                  <span className="sr-only">{t("team.columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const role = roles.find((entry) => entry.id === member.roleId);
                const roleName = role ? t(role.nameKey) : member.roleId;
                const companiesText = companyLabel(member, companies, t("team.allCompanies"));

                return (
                  <tr className="dashboard-list__row" key={member.id}>
                    <td className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="dashboard-list__avatar shrink-0" title={member.name}>
                          {member.initials}
                        </span>
                        <span className="min-w-0">
                          <span className="dashboard-list__primary" title={member.name}>
                            {member.name}
                          </span>
                          <span className="dashboard-list__secondary" title={member.email}>
                            {member.email}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="min-w-0">
                      <StatusBadge size="xs" tone={roleTone[member.roleId] ?? "blue"}>
                        {roleName}
                      </StatusBadge>
                    </td>
                    <td>
                      <ScopeBadge scope={member.dataScope} />
                    </td>
                    <td className="min-w-0">
                      <span
                        className="block truncate text-[12px] font-medium text-[#405069]"
                        title={companiesText}
                      >
                        {companiesText}
                      </span>
                    </td>
                    <td>
                      <StatusBadge size="xs" tone={statusTone[member.status]}>
                        {t(`status.${member.status}`)}
                      </StatusBadge>
                    </td>
                    <td>
                      <span className="dashboard-list__secondary">{member.lastActivityLabel}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      <UserActionsMenu member={member} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="divide-y divide-[rgb(220_229_239/0.7)] border-t border-[rgb(217_227_238/0.72)] md:hidden">
        {members.map((member) => {
          const role = roles.find((entry) => entry.id === member.roleId);
          const roleName = role ? t(role.nameKey) : member.roleId;
          const companiesText = companyLabel(member, companies, t("team.allCompanies"));

          return (
            <li className="flex gap-3 px-4 py-3" key={member.id}>
              <span className="dashboard-list__avatar mt-0.5 shrink-0">{member.initials}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1b2d47]" title={member.name}>
                      {member.name}
                    </p>
                    <p className="truncate text-[12px] text-[#7a899e]" title={member.email}>
                      {member.email}
                    </p>
                  </div>
                  <UserActionsMenu member={member} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge size="xs" tone={roleTone[member.roleId] ?? "blue"}>
                    {roleName}
                  </StatusBadge>
                  <ScopeBadge scope={member.dataScope} />
                  <StatusBadge size="xs" tone={statusTone[member.status]}>
                    {t(`status.${member.status}`)}
                  </StatusBadge>
                </div>
                <p className="mt-2 truncate text-[12px] text-[#66758d]" title={companiesText}>
                  {companiesText}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
