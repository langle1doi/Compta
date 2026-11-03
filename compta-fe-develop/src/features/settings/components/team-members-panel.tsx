"use client";

import { ChevronLeft, ChevronRight, Filter, MoreHorizontal, Search, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";
import type { Tone } from "@/mocks/dashboard/types";

import type { Company, Role, TeamMember, UserStatus } from "../types";
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

const PAGE_SIZE = 10;

function formatCompanies(
  member: TeamMember,
  companies: Company[],
  allLabel: string,
  moreLabel: (count: number) => string,
) {
  if (member.dataScope === "TENANT") return { primary: allLabel, extra: null as string | null };
  const names = member.companyIds
    .map((id) => companies.find((company) => company.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return { primary: "—", extra: null };
  if (names.length === 1) return { primary: names[0]!, extra: null };
  if (names.length === 2) return { primary: names[0]!, extra: names[1]! };
  return { primary: names[0]!, extra: moreLabel(names.length - 1) };
}

export function TeamMembersPanel({
  members,
  roles,
  companies,
  selectedUserId,
  onSelectUser,
  onInvite,
}: {
  members: TeamMember[];
  roles: Role[];
  companies: Company[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onInvite: () => void;
}) {
  const t = useTranslations("usersPermissions");
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (needle) {
        const hay = `${member.name} ${member.email}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (statusFilter !== "all" && member.status !== statusFilter) return false;
      if (companyFilter !== "all") {
        if (member.dataScope === "TENANT") return true;
        if (!member.companyIds.includes(companyFilter)) return false;
      }
      return true;
    });
  }, [members, query, companyFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <section
      aria-labelledby="team-members-title"
      className="dashboard-card dashboard-list dashboard-enter flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <div className="flex shrink-0 min-w-0 flex-wrap items-start justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <h3 className="dashboard-card-title" id="team-members-title">
            {t("team.title")}
          </h3>
          <p className="mt-1 max-w-[52ch] text-[12px] leading-5 text-[#7a899e]">{t("team.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            aria-label={t("team.moreActions")}
            className="action-motion soft-button grid h-10 w-10 place-items-center rounded-[10px] text-[#506078]"
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
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

      <div className="flex shrink-0 min-w-0 flex-wrap items-center gap-2 border-t border-[rgb(217_227_238/0.72)] px-4 py-2.5">
        <label className="relative min-w-0 flex-1 basis-[200px]">
          <span className="sr-only">{t("team.search")}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#8a97ab]"
          />
          <input
            className="h-9 w-full rounded-[10px] border border-[#dfe6f1] bg-white pr-3 pl-9 text-[13px] text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30"
            placeholder={t("team.search")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <button
          className="soft-button inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[12px] font-semibold text-[#506078]"
          type="button"
        >
          <Filter aria-hidden="true" className="h-3.5 w-3.5" />
          {t("team.filter")}
        </button>
        <select
          aria-label={t("team.columns.companies")}
          className="h-9 min-w-[140px] rounded-[10px] border border-[#dfe6f1] bg-white px-2.5 text-[12px] font-medium text-[#405069]"
          value={companyFilter}
          onChange={(event) => {
            setCompanyFilter(event.target.value);
            setPage(0);
          }}
        >
          <option value="all">{t("team.allCompaniesFilter")}</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t("team.columns.status")}
          className="h-9 min-w-[120px] rounded-[10px] border border-[#dfe6f1] bg-white px-2.5 text-[12px] font-medium text-[#405069]"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as "all" | UserStatus);
            setPage(0);
          }}
        >
          <option value="all">{t("team.allStatuses")}</option>
          <option value="ACTIVE">{t("status.ACTIVE")}</option>
          <option value="INVITED">{t("status.INVITED")}</option>
          <option value="DISABLED">{t("status.DISABLED")}</option>
        </select>
      </div>

      <div className="dashboard-scroll min-h-0 flex-1 overflow-auto">
        <div className="hidden min-w-0 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-left">
              <thead className="dashboard-list__head">
                <tr>
                  <th className="w-10">
                    <span className="sr-only">{t("team.select")}</span>
                  </th>
                  <th className="w-[28%]">{t("team.columns.user")}</th>
                  <th className="w-[18%]">{t("team.columns.companies")}</th>
                  <th className="w-[16%]">{t("team.columns.role")}</th>
                  <th className="w-[12%]">{t("team.columns.status")}</th>
                  <th className="w-[14%]">{t("team.columns.activity")}</th>
                  <th className="w-[7.5rem]">
                    <span className="sr-only">{t("team.columns.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {slice.map((member) => {
                  const role = roles.find((entry) => entry.id === member.roleId);
                  const roleName = role ? t(role.nameKey) : member.roleId;
                  const companiesText = formatCompanies(
                    member,
                    companies,
                    t("team.allCompanies"),
                    (count) => t("team.moreCompanies", { count }),
                  );
                  const selected = member.id === selectedUserId;

                  return (
                    <tr
                      className={cn(
                        "dashboard-list__row cursor-pointer transition-colors duration-150",
                        selected && "users-row--selected",
                      )}
                      key={member.id}
                      onClick={() => onSelectUser(member.id)}
                    >
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          aria-label={t("team.selectUser", { name: member.name })}
                          checked={selected}
                          className="h-4 w-4 accent-[#044ce2]"
                          type="checkbox"
                          onChange={() => onSelectUser(member.id)}
                        />
                      </td>
                      <td className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="dashboard-list__avatar shrink-0">{member.initials}</span>
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
                        <span
                          className="block truncate text-[12px] font-medium text-[#405069]"
                          title={companiesText.primary}
                        >
                          {companiesText.primary}
                        </span>
                        {companiesText.extra ? (
                          <span className="block truncate text-[11px] text-[#7a899e]">
                            {companiesText.extra}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <StatusBadge size="xs" tone={roleTone[member.roleId] ?? "blue"}>
                          {roleName}
                        </StatusBadge>
                      </td>
                      <td>
                        <StatusBadge size="xs" tone={statusTone[member.status]}>
                          {t(`status.${member.status}`)}
                        </StatusBadge>
                      </td>
                      <td>
                        <span className="dashboard-list__secondary">{member.lastActivityLabel}</span>
                      </td>
                      <td
                        className="whitespace-nowrap"
                        onClick={(event) => event.stopPropagation()}
                      >
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
          {slice.map((member) => {
            const role = roles.find((entry) => entry.id === member.roleId);
            const roleName = role ? t(role.nameKey) : member.roleId;
            const companiesText = formatCompanies(
              member,
              companies,
              t("team.allCompanies"),
              (count) => t("team.moreCompanies", { count }),
            );
            const selected = member.id === selectedUserId;
            return (
              <li
                className={cn(
                  "flex gap-2 px-4 py-3 transition-colors duration-150",
                  selected && "users-row--selected",
                )}
                key={member.id}
              >
                <button
                  className="flex min-w-0 flex-1 gap-3 text-left"
                  type="button"
                  onClick={() => onSelectUser(member.id)}
                >
                  <span className="dashboard-list__avatar mt-0.5 shrink-0">{member.initials}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#1b2d47]">
                      {member.name}
                    </span>
                    <span className="block truncate text-[12px] text-[#7a899e]">{member.email}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge size="xs" tone={roleTone[member.roleId] ?? "blue"}>
                        {roleName}
                      </StatusBadge>
                      <StatusBadge size="xs" tone={statusTone[member.status]}>
                        {t(`status.${member.status}`)}
                      </StatusBadge>
                    </span>
                    <span className="mt-1.5 block truncate text-[12px] text-[#66758d]">
                      {companiesText.primary}
                      {companiesText.extra ? ` · ${companiesText.extra}` : ""}
                    </span>
                  </span>
                </button>
                <div className="shrink-0 self-start">
                  <UserActionsMenu member={member} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex shrink-0 min-w-0 flex-wrap items-center justify-between gap-2 border-t border-[rgb(217_227_238/0.72)] px-4 py-2.5 text-[12px] text-[#66758d]">
        <p>
          {t("team.showing", { from, to, total: filtered.length })}
        </p>
        <div className="flex items-center gap-1">
          <button
            aria-label={t("team.prevPage")}
            className="soft-button grid h-9 w-9 place-items-center rounded-[9px] disabled:opacity-40"
            disabled={safePage === 0}
            type="button"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              aria-current={index === safePage ? "page" : undefined}
              className={cn(
                "grid h-9 min-w-9 place-items-center rounded-[9px] px-2 text-[12px] font-semibold",
                index === safePage
                  ? "bg-[#eef4ff] text-[#1456d9]"
                  : "text-[#506078] hover:bg-[#f4f8ff]",
              )}
              key={index}
              type="button"
              onClick={() => setPage(index)}
            >
              {index + 1}
            </button>
          ))}
          <button
            aria-label={t("team.nextPage")}
            className="soft-button grid h-9 w-9 place-items-center rounded-[9px] disabled:opacity-40"
            disabled={safePage >= pageCount - 1}
            type="button"
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
          <span className="ml-2 text-[#98a4b5]">{t("team.rowsPerPage", { count: PAGE_SIZE })}</span>
        </div>
      </div>
    </section>
  );
}
