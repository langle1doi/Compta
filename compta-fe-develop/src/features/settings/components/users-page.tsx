"use client";

import { Plus, Search, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { ApiErrorState } from "@/components/compte/api-error-state";
import { PageSizeSelect } from "@/components/compte/page-size-select";
import { SoftSelect } from "@/components/compte/soft-select";
import { SoftToast } from "@/components/compte/soft-toast";
import { StatusBadge } from "@/components/dashboard/tone";
import { ApiError } from "@/lib/api/client";
import { useApiErrorMessage } from "@/lib/api/use-api-error";
import { useSubmitLock } from "@/lib/use-submit-lock";
import type { Tone } from "@/mocks/dashboard/types";

import { Can, useCan } from "../can";
import { roleDisplayName } from "../role-label";
import {
  ALL_COMPANIES,
  useCompanies,
  useRoles,
  useUserMutations,
  useUsers,
  type RoleView,
  type UserMembership,
  type UserView,
} from "../settings-service";
import type { Membership, UserStatus } from "../types";
import { ConfirmDialog } from "./confirm-dialog";
import { SettingsShell } from "./settings-shell";
import { SettingsSheet } from "./settings-sheet";
import { UserActionsMenu } from "./user-actions-menu";

const statusTone: Record<UserStatus, Tone> = {
  ACTIVE: "green",
  INVITED: "orange",
  DISABLED: "slate",
};

type RoleOption = Pick<RoleView, "id" | "label" | "nameKey">;
type CompanyOption = { id: string; name: string };

/** Password policy of POST /users (PASSWORD_MIN_LENGTH on the backend). */
const PASSWORD_MIN_LENGTH = 12;

const SYSTEM_ROLE_NAME_KEYS: Record<string, string> = {
  tenant_admin: "roles.tenantAdmin.name",
  owner: "roles.businessOwner.name",
  accountant: "roles.accountant.name",
  sales: "roles.sales.name",
  viewer: "roles.viewer.name",
};

/** System roles are translated; a custom role only has the name its creator gave it. */
function membershipRoleName(membership: UserMembership, t: (key: string) => string) {
  const key = SYSTEM_ROLE_NAME_KEYS[membership.roleKey];
  return key ? t(key) : membership.roleName;
}

export function UsersPage() {
  const t = useTranslations("settingsUsers");
  const tUp = useTranslations("usersPermissions");
  const check = useCan();
  const { message } = useApiErrorMessage();
  const { users, isLoading, error: loadError } = useUsers();
  const { roles: roleList } = useRoles();
  const { companies: companyList } = useCompanies();
  const mutations = useUserMutations();
  const [notice, setNotice] = useState("");
  // /roles needs role.manage: without it, offer the roles already seen on this tenant's users.
  const roles = useMemo<RoleOption[]>(() => {
    if (roleList.length > 0) return roleList;
    const seen = new Map<string, RoleOption>();
    for (const membership of users.flatMap((user) => user.memberships)) {
      const nameKey = SYSTEM_ROLE_NAME_KEYS[membership.roleKey] ?? `custom.${membership.roleId}.name`;
      seen.set(membership.roleId, {
        id: membership.roleId,
        nameKey,
        label: SYSTEM_ROLE_NAME_KEYS[membership.roleKey] ? undefined : membership.roleName,
      });
    }
    return [...seen.values()];
  }, [roleList, users]);
  const companies = useMemo<CompanyOption[]>(
    () => [
      { id: ALL_COMPANIES, name: t("filters.allCompanies") },
      ...companyList.filter((company) => company.status === "ACTIVE"),
    ],
    [companyList, t],
  );
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [disableUserId, setDisableUserId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (needle) {
        const hay = `${user.name} ${user.email}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      if (companyFilter !== "all" && !user.memberships.some((m) => m.companyId === companyFilter)) {
        return false;
      }
      if (roleFilter !== "all" && !user.memberships.some((m) => m.roleId === roleFilter)) {
        return false;
      }
      return true;
    });
  }, [users, query, companyFilter, roleFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const from = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(filtered.length, safePage * pageSize + pageSize);
  const editingUser = users.find((user) => user.id === editUserId) ?? null;

  function openEdit(userId: string) {
    setEditUserId(userId);
  }

  // Every user write demands tenant-wide scope on the backend.
  const canWrite = check("user.update", "TENANT");

  const hasActiveFilters =
    Boolean(query.trim()) ||
    companyFilter !== "all" ||
    roleFilter !== "all" ||
    statusFilter !== "all";

  return (
    <SettingsShell>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <p className="max-w-[58ch] text-[12px] leading-5 text-[#7a899e]">{t("hint")}</p>
          <Can minScope="TENANT" permission="user.invite">
            <button
              className="action-motion soft-primary inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-xs font-semibold text-white"
              type="button"
              onClick={() => setInviteOpen(true)}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              {t("invite")}
            </button>
          </Can>
        </div>

        <section className="dashboard-card dashboard-list dashboard-enter flex min-h-[320px] min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 min-w-0 flex-col gap-2 border-b border-[rgb(217_227_238/0.72)] px-3.5 py-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="relative min-w-0 flex-1 sm:basis-[220px]">
              <span className="sr-only">{t("search")}</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#8a97ab]"
              />
              <input
                className="compte-search-input h-9 w-full rounded-[10px] border border-[#dfe6f1] bg-white pr-3 pl-9 text-[13px] text-[#063586] outline-none"
                placeholder={t("search")}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <SoftSelect
                className="w-full min-w-[148px] sm:w-[160px]"
                hideLabel
                label={t("filters.company")}
                options={[
                  { value: "all", label: t("filters.allCompanies") },
                  ...companies
                    .filter((company) => company.id !== ALL_COMPANIES)
                    .map((company) => ({
                      value: company.id,
                      label: company.name,
                    })),
                ]}
                triggerClassName="h-9 rounded-[10px] text-[12px]"
                value={companyFilter}
                onChange={(value) => {
                  setCompanyFilter(value);
                  setPage(0);
                }}
              />
              <SoftSelect
                className="w-full min-w-[148px] sm:w-[150px]"
                hideLabel
                label={t("filters.role")}
                options={[
                  { value: "all", label: t("filters.allRoles") },
                  ...roles.map((role) => ({
                    value: role.id,
                    label: roleDisplayName(role, tUp),
                  })),
                ]}
                triggerClassName="h-9 rounded-[10px] text-[12px]"
                value={roleFilter}
                onChange={(value) => {
                  setRoleFilter(value);
                  setPage(0);
                }}
              />
              <SoftSelect
                className="w-full min-w-[132px] sm:w-[140px]"
                hideLabel
                label={t("filters.status")}
                options={[
                  { value: "all", label: t("filters.allStatuses") },
                  { value: "ACTIVE", label: tUp("status.ACTIVE") },
                  { value: "INVITED", label: tUp("status.INVITED") },
                  { value: "DISABLED", label: tUp("status.DISABLED") },
                ]}
                triggerClassName="h-9 rounded-[10px] text-[12px]"
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value as "all" | UserStatus);
                  setPage(0);
                }}
              />
            </div>
          </div>

          {loadError ? (
            <ApiErrorState error={loadError} />
          ) : isLoading ? (
            <div className="min-h-0 flex-1" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <UsersRound aria-hidden="true" className="h-8 w-8 text-[#b7c3d6]" />
              <p className="text-sm font-semibold text-[#24334c]">
                {hasActiveFilters ? t("empty.filteredTitle") : t("empty.title")}
              </p>
              <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">
                {hasActiveFilters ? t("empty.filteredBody") : t("empty.body")}
              </p>
              {hasActiveFilters ? (
                <button
                  className="action-motion soft-button mt-2 h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCompanyFilter("all");
                    setRoleFilter("all");
                    setStatusFilter("all");
                    setPage(0);
                  }}
                >
                  {t("empty.clear")}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="dashboard-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto">
              <div className="hidden min-w-0 md:block">
                <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-left">
                  <thead className="dashboard-list__head sticky top-0 z-[1]">
                    <tr>
                      <th className="w-[16%]">{t("columns.user")}</th>
                      <th className="w-[20%]">{t("columns.email")}</th>
                      <th className="w-[14%]">{t("columns.companies")}</th>
                      <th className="w-[14%]">{t("columns.role")}</th>
                      <th className="w-[10%]">{t("columns.status")}</th>
                      <th className="w-[10%]">{t("columns.activity")}</th>
                      <th className="w-[116px] min-w-[116px]">
                        <span className="sr-only">{t("columns.actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((user) => {
                      const primary = user.memberships[0];
                      const companyNames = user.memberships
                        .map((m) => companies.find((c) => c.id === m.companyId)?.name)
                        .filter(Boolean) as string[];
                      const extraCompanies = Math.max(0, companyNames.length - 1);
                      return (
                        <tr
                          className="dashboard-list__row cursor-pointer transition-colors duration-150 hover:bg-[#f7fafd]"
                          key={user.id}
                          onClick={() => openEdit(user.id)}
                        >
                          <td className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="dashboard-list__avatar shrink-0">
                                {user.initials}
                              </span>
                              <span
                                className="dashboard-list__primary truncate"
                                title={user.name}
                              >
                                {user.name}
                              </span>
                            </div>
                          </td>
                          <td className="min-w-0">
                            <span
                              className="block truncate text-[12px] text-[#66758d]"
                              title={user.email}
                            >
                              {user.email}
                            </span>
                          </td>
                          <td className="min-w-0">
                            <span
                              className="block truncate text-[12px] font-medium text-[#405069]"
                              title={companyNames.join(", ")}
                            >
                              {companyNames[0] ?? "—"}
                              {extraCompanies > 0 ? (
                                <span className="text-[#7a899e]"> +{extraCompanies}</span>
                              ) : null}
                            </span>
                          </td>
                          <td>
                            {primary ? (
                              <StatusBadge size="xs" tone="purple">
                                {membershipRoleName(primary, tUp)}
                              </StatusBadge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <StatusBadge size="xs" tone={statusTone[user.status]}>
                              {tUp(`status.${user.status}`)}
                            </StatusBadge>
                          </td>
                          <td>
                            <span className="dashboard-list__secondary">
                              {user.lastActivityLabel}
                            </span>
                          </td>
                          <td
                            className="whitespace-nowrap"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <UserActionsMenu
                              member={{
                                id: user.id,
                                name: user.name,
                                email: user.email,
                                initials: user.initials,
                                roleId: primary?.roleId ?? "",
                                dataScope: "COMPANY",
                                companyIds: user.memberships.map((m) => m.companyId),
                                status: user.status,
                                lastActivityLabel: user.lastActivityLabel,
                              }}
                              onDisable={canWrite ? () => setDisableUserId(user.id) : undefined}
                              onEdit={() => openEdit(user.id)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[rgb(220_229_239/0.7)] md:hidden">
                {slice.map((user) => {
                  const primary = user.memberships[0];
                  const companyNames = user.memberships
                    .map((m) => companies.find((c) => c.id === m.companyId)?.name)
                    .filter(Boolean) as string[];
                  const extraCompanies = Math.max(0, companyNames.length - 1);
                  return (
                    <li className="flex gap-2 px-4 py-3" key={user.id}>
                      <button
                        className="flex min-w-0 flex-1 gap-3 text-left"
                        type="button"
                        onClick={() => openEdit(user.id)}
                      >
                        <span className="dashboard-list__avatar mt-0.5 shrink-0">
                          {user.initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#1b2d47]">
                            {user.name}
                          </span>
                          <span className="block truncate text-[12px] text-[#7a899e]">
                            {user.email}
                          </span>
                          <span className="mt-1 block truncate text-[11px] text-[#66758d]">
                            {companyNames[0] ?? "—"}
                            {extraCompanies > 0 ? ` +${extraCompanies}` : ""}
                          </span>
                          <span className="mt-2 inline-flex flex-wrap gap-1.5">
                            {primary ? (
                              <StatusBadge size="xs" tone="purple">
                                {membershipRoleName(primary, tUp)}
                              </StatusBadge>
                            ) : null}
                            <StatusBadge size="xs" tone={statusTone[user.status]}>
                              {tUp(`status.${user.status}`)}
                            </StatusBadge>
                          </span>
                        </span>
                      </button>
                      <div className="shrink-0 self-start">
                        <UserActionsMenu
                          member={{
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            initials: user.initials,
                            roleId: primary?.roleId ?? "",
                            dataScope: "COMPANY",
                            companyIds: user.memberships.map((m) => m.companyId),
                            status: user.status,
                            lastActivityLabel: user.lastActivityLabel,
                          }}
                          onDisable={canWrite ? () => setDisableUserId(user.id) : undefined}
                          onEdit={() => openEdit(user.id)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex shrink-0 min-w-0 flex-wrap items-center justify-between gap-2 border-t border-[rgb(217_227_238/0.72)] py-2.5 pr-20 pl-3.5 text-[12px] text-[#66758d]">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p>{t("showing", { from, to, total: filtered.length })}</p>
              <PageSizeSelect
                label={t("pagination.pageSize")}
                formatOption={(count) => t("pagination.rowsPerPage", { count })}
                value={pageSize}
                onChange={(size) => { setPageSize(size); setPage(0); }}
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                aria-label={t("prevPage")}
                className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold disabled:opacity-40"
                disabled={safePage === 0}
                type="button"
                onClick={() => setPage(Math.max(0, safePage - 1))}
              >
                {t("pagination.prev")}
              </button>
              <span className="min-w-8 px-1 text-center font-semibold text-[#405069]">
                {safePage + 1}/{pageCount}
              </span>
              <button
                aria-label={t("nextPage")}
                className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold disabled:opacity-40"
                disabled={safePage >= pageCount - 1}
                type="button"
                onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              >
                {t("pagination.next")}
              </button>
            </div>
          </div>
        </section>
      </div>

      <EditUserSheet
        companies={companies}
        open={editUserId !== null}
        roles={roles}
        user={editingUser}
        onClose={() => setEditUserId(null)}
        onDisable={(userId) => {
          setEditUserId(null);
          setDisableUserId(userId);
        }}
      />

      <InviteUserSheet
        companies={companies}
        open={inviteOpen}
        roles={roles}
        onClose={() => setInviteOpen(false)}
      />

      <ConfirmDialog
        body={t("disableConfirm.body")}
        cancelLabel={tUp("dialogs.cancel")}
        confirmLabel={t("disableConfirm.confirm")}
        danger
        open={disableUserId !== null}
        title={t("disableConfirm.title")}
        onCancel={() => setDisableUserId(null)}
        onConfirm={() => {
          const id = disableUserId;
          setDisableUserId(null);
          if (!id) return;
          mutations.disable.mutate(id, { onError: (caught) => setNotice(message(caught)) });
        }}
      />

      {notice ? <SoftToast message={notice} tone="error" onDismiss={() => setNotice("")} /> : null}
    </SettingsShell>
  );
}

function EditUserSheet({
  open,
  user,
  roles,
  companies,
  onClose,
  onDisable,
}: {
  open: boolean;
  user: UserView | null;
  roles: RoleOption[];
  companies: CompanyOption[];
  onClose: () => void;
  onDisable: (userId: string) => void;
}) {
  const t = useTranslations("settingsUsers");

  if (!user) {
    return (
      <SettingsSheet open={open} title={t("edit.title")} onClose={onClose}>
        {null}
      </SettingsSheet>
    );
  }

  return (
    <EditUserSheetForm
      key={user.id}
      companies={companies}
      open={open}
      roles={roles}
      user={user}
      onClose={onClose}
      onDisable={onDisable}
    />
  );
}

function EditUserSheetForm({
  open,
  user,
  roles,
  companies,
  onClose,
  onDisable,
}: {
  open: boolean;
  user: UserView;
  roles: RoleOption[];
  companies: CompanyOption[];
  onClose: () => void;
  onDisable: (userId: string) => void;
}) {
  const t = useTranslations("settingsUsers");
  const tUp = useTranslations("usersPermissions");
  const check = useCan();
  const canWrite = check("user.update", "TENANT");
  const { message, fieldMessage } = useApiErrorMessage();
  const { save } = useUserMutations();
  const [error, setError] = useState("");
  const [name, setName] = useState(user.name);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [memberships, setMemberships] = useState<Membership[]>(() =>
    user.memberships.map((m) => ({ ...m })),
  );

  async function submit() {
    setError("");
    try {
      await save.mutateAsync({
        user,
        next: { name: name.trim() || user.name, status, memberships },
      });
      onClose();
    } catch (caught) {
      const field = caught instanceof ApiError ? caught.fields[0] : undefined;
      setError(field ? fieldMessage(field) : message(caught));
    }
  }

  function addMembership() {
    const available = companies.find(
      (company) => !memberships.some((m) => m.companyId === company.id),
    );
    if (!available) return;
    setMemberships((current) => [
      ...current,
      {
        id: `m-new-${Date.now()}`,
        userId: user.id,
        companyId: available.id,
        roleId: roles[0]?.id ?? "",
      },
    ]);
  }

  return (
    <SettingsSheet
      description={t("edit.body")}
      open={open}
      title={t("edit.title")}
      widthClassName="sm:max-w-[500px]"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Can minScope="TENANT" permission="user.disable">
            {user.status !== "DISABLED" ? (
              <button
                className="text-[12px] font-semibold text-[#c9564f] hover:underline"
                type="button"
                onClick={() => onDisable(user.id)}
              >
                {tUp("userActions.disable")}
              </button>
            ) : (
              <span />
            )}
          </Can>
          <div className="flex gap-2">
            <button
              className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
              type="button"
              onClick={onClose}
            >
              {tUp("dialogs.cancel")}
            </button>
            <Can minScope="TENANT" permission="user.update">
              <button
                className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-60"
                disabled={save.isPending}
                type="button"
                onClick={() => void submit()}
              >
                {t("edit.save")}
              </button>
            </Can>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-[12px] border border-[#e8eef6] bg-[rgb(248_251_255/0.8)] px-3 py-2.5">
          <span className="dashboard-list__avatar h-10 w-10 shrink-0 text-[12px]">{user.initials}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1b2d47]">{user.email}</p>
            <StatusBadge size="xs" tone={statusTone[status]}>
              {tUp(`status.${status}`)}
            </StatusBadge>
          </div>
        </div>

        <label className="block" htmlFor="edit-user-name">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">{t("edit.name")}</span>
          <input
            className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30 disabled:bg-[#f7fafd] disabled:text-[#66758d]"
            disabled={!canWrite}
            id="edit-user-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="block" htmlFor="edit-user-email">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">{t("edit.email")}</span>
          <input
            className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-[#f7fafd] px-3 text-sm text-[#66758d]"
            id="edit-user-email"
            readOnly
            value={user.email}
          />
        </label>

        <label className="block" htmlFor="edit-user-status">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">{t("edit.status")}</span>
          <select
            className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm text-[#063586]"
            disabled={!canWrite}
            id="edit-user-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as UserStatus)}
          >
            <option value="ACTIVE">{tUp("status.ACTIVE")}</option>
            {/* Set by the backend only: it can be shown but not chosen. */}
            {user.status === "INVITED" ? (
              <option disabled value="INVITED">
                {tUp("status.INVITED")}
              </option>
            ) : null}
            <option value="DISABLED">{tUp("status.DISABLED")}</option>
          </select>
        </label>

        <fieldset>
          <legend className="mb-1.5 text-[11px] font-medium text-[#5f6f88]">
            {t("edit.memberships")}
          </legend>
          <p className="mb-2 text-[11px] leading-4 text-[#7a899e]">{t("edit.membershipsHint")}</p>
          <div className="space-y-2">
            {memberships.map((membership, index) => (
              <div
                className="grid gap-2 rounded-[12px] border border-[#e8eef6] p-2.5 sm:grid-cols-[1fr_1fr_auto]"
                key={membership.id}
              >
                <select
                  aria-label={t("edit.company")}
                  className="h-9 rounded-[10px] border border-[#dfe6f1] bg-white px-2 text-[12px] text-[#063586]"
                  disabled={!canWrite}
                  value={membership.companyId}
                  onChange={(event) => {
                    const companyId = event.target.value;
                    setMemberships((current) =>
                      current.map((entry, i) => (i === index ? { ...entry, companyId } : entry)),
                    );
                  }}
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t("edit.role")}
                  className="h-9 rounded-[10px] border border-[#dfe6f1] bg-white px-2 text-[12px] text-[#063586]"
                  disabled={!canWrite}
                  value={membership.roleId}
                  onChange={(event) => {
                    const roleId = event.target.value;
                    setMemberships((current) =>
                      current.map((entry, i) => (i === index ? { ...entry, roleId } : entry)),
                    );
                  }}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {roleDisplayName(role, tUp)}
                    </option>
                  ))}
                </select>
                {canWrite ? (
                  <button
                    className="h-9 rounded-[10px] px-2 text-[12px] font-semibold text-[#c9564f] hover:bg-[#fff0ed]"
                    type="button"
                    onClick={() =>
                      setMemberships((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    {t("edit.removeMembership")}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {canWrite ? (
            <button
              className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-2 text-[12px] font-semibold text-[#044ce2]"
              type="button"
              onClick={addMembership}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              {t("edit.addMembership")}
            </button>
          ) : null}
        </fieldset>
        {error ? (
          <p className="text-[12px] text-[#c9564f]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SettingsSheet>
  );
}

function InviteUserSheet({
  open,
  roles,
  companies,
  onClose,
}: {
  open: boolean;
  roles: RoleOption[];
  companies: CompanyOption[];
  onClose: () => void;
}) {
  const t = useTranslations("settingsUsers");
  const tUp = useTranslations("usersPermissions");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pickedCompanyId, setCompanyId] = useState<string>();
  const [pickedRoleId, setRoleId] = useState<string>();
  const [error, setError] = useState<string>();
  const { message, fieldMessage } = useApiErrorMessage();
  const { create } = useUserMutations();
  const lock = useSubmitLock();
  // Options load after this form first renders.
  const companyId = pickedCompanyId ?? companies[0]?.id ?? "";
  const roleId = pickedRoleId ?? roles[0]?.id ?? "";

  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t("inviteSheet.errors.email"));
      return;
    }
    if (!name.trim()) {
      setError(t("inviteSheet.errors.name"));
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t("inviteSheet.errors.password", { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    if (!companyId || !roleId) {
      setError(t("inviteSheet.errors.membership"));
      return;
    }
    setError(undefined);
    await lock(async () => {
      try {
        await create.mutateAsync({
          name: name.trim(),
          email: email.trim(),
          password,
          memberships: [{ companyId, roleId }],
        });
        setName("");
        setEmail("");
        setPassword("");
        onClose();
      } catch (caught) {
        const field = caught instanceof ApiError ? caught.fields[0] : undefined;
        setError(field ? fieldMessage(field) : message(caught));
      }
    });
  }

  return (
    <SettingsSheet
      description={t("inviteSheet.body")}
      open={open}
      title={t("inviteSheet.title")}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            type="button"
            onClick={onClose}
          >
            {tUp("dialogs.cancel")}
          </button>
          <button
            className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={create.isPending}
            type="button"
            onClick={() => void submit()}
          >
            {t("inviteSheet.send")}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">{t("edit.name")}</span>
          <input
            className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">{t("edit.email")}</span>
          <input
            className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
            {t("inviteSheet.password")}
          </span>
          <input
            autoComplete="new-password"
            className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="mt-1 block text-[11px] text-[#7a899e]">
            {t("inviteSheet.passwordHint", { min: PASSWORD_MIN_LENGTH })}
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">{t("edit.company")}</span>
          <select
            className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">{t("edit.role")}</span>
          <select
            className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm"
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {roleDisplayName(role, tUp)}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="text-[12px] text-[#c9564f]">{error}</p> : null}
      </div>
    </SettingsSheet>
  );
}
