"use client";

import { Building2, Globe2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { StatusBadge } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";
import type { Tone } from "@/mocks/dashboard/types";

import { suggestedScopeForRole } from "../mocks/roles";
import type { Company, DataScope, Role, TeamMember, UserStatus } from "../types";

const statusTone: Record<UserStatus, Tone> = {
  ACTIVE: "green",
  INVITED: "orange",
  DISABLED: "slate",
};

const scopes: Array<{ id: DataScope; icon: typeof UserRound }> = [
  { id: "OWN", icon: UserRound },
  { id: "COMPANY", icon: Building2 },
  { id: "TENANT", icon: Globe2 },
];

type Draft = {
  roleId: string;
  companyIds: string[];
  dataScope: DataScope;
};

export function EditUserCard({
  member,
  roles,
  companies,
  onCancel,
  onSave,
}: {
  member: TeamMember | null;
  roles: Role[];
  companies: Company[];
  onCancel: () => void;
  onSave: (userId: string, draft: Draft) => void;
}) {
  const t = useTranslations("usersPermissions");

  if (!member) {
    return (
      <section
        aria-labelledby="edit-user-title"
        className="dashboard-card dashboard-enter flex h-full min-h-[220px] min-w-0 flex-col p-4"
      >
        <h3 className="dashboard-card-title" id="edit-user-title">
          {t("editUser.title")}
        </h3>
        <p className="mt-6 text-sm leading-6 text-[#7a899e]">{t("editUser.empty")}</p>
      </section>
    );
  }

  return (
    <EditUserForm
      companies={companies}
      key={member.id}
      member={member}
      roles={roles}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

function EditUserForm({
  member,
  roles,
  companies,
  onCancel,
  onSave,
}: {
  member: TeamMember;
  roles: Role[];
  companies: Company[];
  onCancel: () => void;
  onSave: (userId: string, draft: Draft) => void;
}) {
  const t = useTranslations("usersPermissions");
  const [draft, setDraft] = useState<Draft>({
    roleId: member.roleId,
    companyIds: [...member.companyIds],
    dataScope: member.dataScope,
  });

  const role = roles.find((entry) => entry.id === draft.roleId);
  const tenantLocked = draft.dataScope === "TENANT";

  function toggleCompany(companyId: string) {
    setDraft((current) => {
      const exists = current.companyIds.includes(companyId);
      return {
        ...current,
        companyIds: exists
          ? current.companyIds.filter((id) => id !== companyId)
          : [...current.companyIds, companyId],
      };
    });
  }

  return (
    <section
      aria-labelledby="edit-user-title"
      className="dashboard-card dashboard-enter flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-4"
    >
      <div className="flex shrink-0 min-w-0 flex-wrap items-start justify-between gap-3">
        <h3 className="dashboard-card-title" id="edit-user-title">
          {t("editUser.title")}
        </h3>
        <button
          className="text-[12px] font-semibold text-[#66758d] hover:text-[#044ce2]"
          type="button"
          onClick={() =>
            setDraft({
              roleId: member.roleId,
              companyIds: [...member.companyIds],
              dataScope: member.dataScope,
            })
          }
        >
          {t("editUser.reset")}
        </button>
      </div>

      <div className="mt-3 flex shrink-0 min-w-0 items-center gap-3 rounded-[12px] border border-[#e8eef6] bg-[rgb(248_251_255/0.8)] px-3 py-2.5">
        <span className="dashboard-list__avatar h-10 w-10 shrink-0 text-[12px]">{member.initials}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#1b2d47]" title={member.name}>
            {member.name}
          </p>
          <p className="truncate text-[12px] text-[#7a899e]" title={member.email}>
            {member.email}
          </p>
        </div>
        <StatusBadge size="xs" tone={statusTone[member.status]}>
          {t(`status.${member.status}`)}
        </StatusBadge>
      </div>

      <div className="dashboard-scroll mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
        <label className="block" htmlFor="edit-user-role">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">{t("editUser.role")}</span>
          <select
            className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30"
            id="edit-user-role"
            value={draft.roleId}
            onChange={(event) => {
              const roleId = event.target.value;
              setDraft((current) => ({
                ...current,
                roleId,
                dataScope: suggestedScopeForRole(roleId),
              }));
            }}
          >
            {roles.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t(entry.nameKey)}
              </option>
            ))}
          </select>
          {role ? (
            <p className="mt-1.5 text-[11px] leading-4 text-[#7a899e]">{t(role.descriptionKey)}</p>
          ) : null}
        </label>

        <fieldset>
          <legend className="mb-1.5 text-[11px] font-medium text-[#5f6f88]">
            {t("editUser.companies")}
          </legend>
          {tenantLocked ? (
            <p className="rounded-[10px] border border-[#e8eef6] bg-[#f7fafd] px-3 py-2.5 text-[12px] text-[#5f6f88]">
              {t("editUser.allCompanies")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 rounded-[10px] border border-[#dfe6f1] p-2">
              {companies.map((company) => {
                const selected = draft.companyIds.includes(company.id);
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex min-h-8 items-center rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors duration-150",
                      selected
                        ? "border-[#b9d0fb] bg-[#eef4ff] text-[#1456d9]"
                        : "border-[#e1e7f1] bg-white text-[#5f6f88] hover:border-[#b9d0fb]",
                    )}
                    key={company.id}
                    type="button"
                    onClick={() => toggleCompany(company.id)}
                  >
                    {company.name}
                    {selected ? <span className="ml-1.5 opacity-70">×</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[11px] font-medium text-[#5f6f88]">
            {t("editUser.scope")}
          </legend>
          <div className="grid gap-1.5" role="radiogroup" aria-label={t("editUser.scope")}>
            {scopes.map((scope) => {
              const selected = draft.dataScope === scope.id;
              const Icon = scope.icon;
              return (
                <button
                  aria-checked={selected}
                  className={cn(
                    "flex min-w-0 items-start gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors duration-150",
                    selected
                      ? "border-[#b9d0fb] bg-[#f2f6ff] shadow-[inset_2px_2px_5px_rgba(71,101,165,0.05)]"
                      : "border-[#e8eef6] bg-white hover:border-[#c9d7ef]",
                  )}
                  key={scope.id}
                  role="radio"
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, dataScope: scope.id }))}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-[8px]",
                      selected ? "bg-[#e7efff] text-[#044ce2]" : "bg-[#eef3fa] text-[#66758d]",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[#1b2d47]">
                      {t(`scope.${scope.id}`)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-[#7a899e]">
                      {t(`scope.desc.${scope.id}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="mt-5 flex shrink-0 justify-end gap-2 border-t border-[#e8eef6] pt-3">
        <button
          className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
          type="button"
          onClick={onCancel}
        >
          {t("editUser.cancel")}
        </button>
        <button
          className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
          type="button"
          onClick={() => onSave(member.id, draft)}
        >
          {t("editUser.save")}
        </button>
      </div>
    </section>
  );
}
