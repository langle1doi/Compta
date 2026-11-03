"use client";

import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";

import type { Company, Role, TeamMember } from "../types";

export function CompanyAccessPanel({
  companies,
  members,
  roles,
  onSelectUser,
}: {
  companies: Company[];
  members: TeamMember[];
  roles: Role[];
  onSelectUser: (userId: string) => void;
}) {
  const t = useTranslations("usersPermissions");

  return (
    <section
      aria-labelledby="company-access-title"
      className="dashboard-card dashboard-enter flex min-w-0 flex-col p-4"
    >
      <h3 className="dashboard-card-title" id="company-access-title">
        {t("companyAccess.title")}
      </h3>
      <p className="mt-1 max-w-[60ch] text-[12px] leading-5 text-[#7a899e]">
        {t("companyAccess.subtitle")}
      </p>

      <div className="mt-4 space-y-3">
        {companies.map((company) => {
          const companyMembers = members.filter(
            (member) =>
              member.dataScope === "TENANT" || member.companyIds.includes(company.id),
          );
          return (
            <div
              className="rounded-[12px] border border-[#e4ebf4] bg-[rgb(255_255_255/0.7)] p-3"
              key={company.id}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1b2d47]">{company.name}</p>
                  <p className="text-[11px] text-[#7a899e]">
                    {company.subtitle ?? company.currency}
                  </p>
                </div>
                <StatusBadge size="xs" tone="blue">
                  {t("companyAccess.memberCount", { count: companyMembers.length })}
                </StatusBadge>
              </div>
              <ul className="mt-2.5 space-y-1">
                {companyMembers.slice(0, 5).map((member) => {
                  const role = roles.find((entry) => entry.id === member.roleId);
                  return (
                    <li key={member.id}>
                      <button
                        className="flex w-full items-center justify-between gap-2 rounded-[10px] px-2 py-1.5 text-left hover:bg-[#f4f8ff]"
                        type="button"
                        onClick={() => onSelectUser(member.id)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-[#24334c]">
                            {member.name}
                          </span>
                          <span className="block truncate text-[11px] text-[#7a899e]">
                            {role ? t(role.nameKey) : member.roleId} · {t(`scope.${member.dataScope}`)}
                          </span>
                        </span>
                        <span className="text-[12px] font-semibold text-[#044ce2]">
                          {t("companyAccess.viewUser")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
