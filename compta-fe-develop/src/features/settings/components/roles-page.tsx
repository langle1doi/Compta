"use client";

import {
  BriefcaseBusiness,
  Calculator,
  Eye,
  Plus,
  Search,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";
import { ApiErrorState } from "@/components/compte/api-error-state";
import { SoftToast } from "@/components/compte/soft-toast";
import { StatusBadge } from "@/components/dashboard/tone";
import { useApiErrorMessage } from "@/lib/api/use-api-error";
import { useSubmitLock } from "@/lib/use-submit-lock";
import { cn } from "@/lib/utils";
import type { Tone } from "@/mocks/dashboard/types";

import { Can, useCan } from "../can";
import { filterPermissionGroups } from "../permissions";
import {
  roleDisplayDescription,
  roleDisplayName,
} from "../role-label";
import {
  BACKEND_PERMISSION_GROUPS,
  togglePermission,
  useRoleMutations,
  useRoles,
  type RoleView,
} from "../settings-service";
import type { PermissionId } from "../types";
import { ConfirmDialog } from "./confirm-dialog";
import { CreateRoleDialog } from "./create-role-dialog";
import { PermissionAccordion } from "./permission-accordion";
import { SettingsShell } from "./settings-shell";

export const ROLES_PAGE_SELECTION_LAYOUT_ID = "compte-roles-page-selection";

const roleVisual: Record<string, { icon: LucideIcon; tone: Tone }> = {
  tenant_admin: { icon: Shield, tone: "purple" },
  owner: { icon: BriefcaseBusiness, tone: "blue" },
  accountant: { icon: Calculator, tone: "green" },
  sales: { icon: UserRound, tone: "orange" },
  viewer: { icon: Eye, tone: "slate" },
};

export function RolesPage() {
  const t = useTranslations("settingsRoles");
  const tUp = useTranslations("usersPermissions");
  const check = useCan();
  const { message } = useApiErrorMessage();
  const { roles, isLoading, error } = useRoles();
  const mutations = useRoleMutations();
  const lock = useSubmitLock();
  const [notice, setNotice] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];

  const deleteBlockedCount = selectedRole?.memberCount ?? 0;

  async function run(action: () => Promise<unknown>) {
    await lock(async () => {
      try {
        await action();
      } catch (caught) {
        setNotice(message(caught));
      }
    });
  }

  if (!selectedRole) {
    return (
      <SettingsShell>
        <section className="dashboard-card flex min-h-[320px] min-w-0 flex-1 flex-col overflow-hidden">
          {error && !isLoading ? <ApiErrorState error={error} /> : null}
        </section>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      <div className="grid min-h-0 min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(220px,0.32fr)_minmax(0,0.68fr)] lg:overflow-hidden">
        <section className="dashboard-card dashboard-enter flex min-h-[220px] min-w-0 flex-col overflow-hidden lg:h-full">
          <div className="shrink-0 border-b border-[rgb(217_227_238/0.72)] px-3 py-3">
            <h3 className="dashboard-card-title">{t("listTitle")}</h3>
            <p className="mt-1 text-[12px] text-[#7a899e]">{t("listSubtitle")}</p>
          </div>
          <AnimatedSelectionGroup
            className="dashboard-scroll min-h-0 flex-1 overflow-y-auto p-2"
            id="compte-roles-page-list"
          >
            <ul className="space-y-1">
              {roles.map((role) => {
                const selected = role.id === selectedRole.id;
                const visual = roleVisual[role.key] ?? { icon: Shield, tone: "blue" as Tone };
                const Icon = visual.icon;
                const count = role.memberCount;
                return (
                  <li key={role.id}>
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "relative flex w-full min-w-0 items-start gap-2.5 rounded-[12px] px-2.5 py-2.5 text-left transition-colors duration-150",
                        selected ? "text-[#044ce2]" : "text-[#405069] hover:bg-[#f4f8ff]",
                      )}
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                    >
                      {selected ? (
                        <AnimatedActiveIndicator
                          borderRadius={12}
                          className="rounded-[12px]"
                          layoutId={ROLES_PAGE_SELECTION_LAYOUT_ID}
                          variant="sidebar"
                        />
                      ) : null}
                      <span
                        className={cn(
                          "relative z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-[8px]",
                          selected ? "bg-[#e7efff] text-[#044ce2]" : "bg-[#eef3fa] text-[#66758d]",
                        )}
                      >
                        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                      <span className="relative z-[1] min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">
                          {roleDisplayName(role, tUp)}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <StatusBadge size="xs" tone={role.system ? "slate" : "blue"}>
                            {role.system ? t("system") : t("custom")}
                          </StatusBadge>
                          <span className="text-[10px] text-[#7a899e]">
                            {t("userCount", { count })} · {tUp(`scope.${role.defaultScope}`)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </AnimatedSelectionGroup>
        </section>

        <RoleDetailPanel
          key={selectedRole.id}
          // Role writes demand tenant-wide scope on the backend.
          canManage={check("role.manage", "TENANT")}
          createAction={
            <Can minScope="TENANT" permission="role.manage">
              <button
                className="action-motion soft-primary inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-white"
                type="button"
                onClick={() => {
                  setCreateKey((value) => value + 1);
                  setCreateOpen(true);
                }}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t("create")}
              </button>
            </Can>
          }
          role={selectedRole}
          userCount={selectedRole.memberCount}
          onDelete={() => setDeleteRoleId(selectedRole.id)}
          onSavePermissions={(next) =>
            void run(() =>
              mutations.savePermissions.mutateAsync({ role: selectedRole, permissions: next }),
            )
          }
        />
      </div>

      <CreateRoleDialog
        key={createKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(payload) =>
          void run(async () => {
            const created = await mutations.create.mutateAsync(payload);
            setSelectedRoleId(created.id);
            setCreateOpen(false);
          })
        }
      />

      <ConfirmDialog
        body={
          deleteBlockedCount > 0
            ? t("deleteBlocked.body", { count: deleteBlockedCount })
            : t("deleteConfirm.body")
        }
        cancelLabel={tUp("dialogs.cancel")}
        confirmLabel={deleteBlockedCount > 0 ? t("deleteBlocked.confirm") : t("delete")}
        danger={deleteBlockedCount === 0}
        open={deleteRoleId !== null}
        title={
          deleteBlockedCount > 0 ? t("deleteBlocked.title") : t("deleteConfirm.title")
        }
        onCancel={() => setDeleteRoleId(null)}
        onConfirm={() => {
          const id = deleteRoleId;
          setDeleteRoleId(null);
          if (!id || deleteBlockedCount > 0) return;
          void run(async () => {
            await mutations.remove.mutateAsync(id);
            setSelectedRoleId(null);
          });
        }}
      />

      {notice ? <SoftToast message={notice} tone="error" onDismiss={() => setNotice("")} /> : null}
    </SettingsShell>
  );
}

function RoleDetailPanel({
  role,
  userCount,
  canManage,
  createAction,
  onSavePermissions,
  onDelete,
}: {
  role: RoleView;
  userCount: number;
  canManage: boolean;
  createAction?: ReactNode;
  onSavePermissions: (permissions: PermissionId[]) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("settingsRoles");
  const tUp = useTranslations("usersPermissions");
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>(["company"]);
  const [editing, setEditing] = useState(false);
  const [draftPermissions, setDraftPermissions] = useState<PermissionId[]>([...role.permissions]);
  const [dirty, setDirty] = useState(false);

  const filteredGroups = useMemo(
    () => filterPermissionGroups(BACKEND_PERMISSION_GROUPS, query),
    [query],
  );
  const allExpanded = filteredGroups.every((group) => expandedIds.includes(group.id));

  return (
    <section className="dashboard-card dashboard-enter flex min-h-[320px] min-w-0 flex-col overflow-hidden lg:h-full">
      <div className="shrink-0 border-b border-[rgb(217_227_238/0.72)] px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="dashboard-card-title">{roleDisplayName(role, tUp)}</h3>
            <p className="mt-1 max-w-[56ch] text-[12px] leading-5 text-[#7a899e]">
              {roleDisplayDescription(role, tUp)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge size="xs" tone={role.system ? "slate" : "blue"}>
                {role.system ? t("system") : t("custom")}
              </StatusBadge>
              <StatusBadge size="xs" tone="blue">
                {tUp(`scope.${role.defaultScope}`)}
              </StatusBadge>
              <StatusBadge size="xs" tone="slate">
                {t("userCount", { count: userCount })}
              </StatusBadge>
              {dirty ? (
                <span className="rounded-[6px] bg-[#fff4e6] px-2 py-0.5 text-[10px] font-semibold text-[#b96d24]">
                  {tUp("permissions.unsaved")}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {createAction}
            {!role.system && canManage ? (
              <button
                className="text-[12px] font-semibold text-[#c9564f] hover:underline"
                type="button"
                onClick={onDelete}
              >
                {t("delete")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-[180px]">
            <span className="sr-only">{tUp("permissions.search")}</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#8a97ab]"
            />
            <input
              className="h-9 w-full rounded-[10px] border border-[#dfe6f1] bg-white pr-3 pl-8 text-[12px] text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30"
              placeholder={tUp("permissions.search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            className="soft-button h-9 rounded-[10px] px-3 text-[12px] font-semibold text-[#506078]"
            type="button"
            onClick={() =>
              setExpandedIds(allExpanded ? [] : filteredGroups.map((group) => group.id))
            }
          >
            {allExpanded ? tUp("permissions.collapseAll") : tUp("permissions.expandAll")}
          </button>
          {canManage && !role.system && !editing ? (
            <button
              className="soft-primary h-9 rounded-[10px] px-3 text-[12px] font-semibold text-white"
              type="button"
              onClick={() => setEditing(true)}
            >
              {tUp("permissions.edit")}
            </button>
          ) : null}
        </div>

        <p className="mb-3 text-[11px] leading-4 text-[#7a899e]">
          {t("scopeNote")} {tUp("permissions.crudHint")}
        </p>

        <PermissionAccordion
          compareRole={null}
          draftPermissions={draftPermissions}
          editing={editing}
          expandedIds={expandedIds}
          groups={filteredGroups}
          selectedRole={role}
          onToggleExpanded={(groupId) => {
            setExpandedIds((current) =>
              current.includes(groupId)
                ? current.filter((id) => id !== groupId)
                : [...current, groupId],
            );
          }}
          onTogglePermission={(permission) => {
            if (!editing) return;
            setDraftPermissions((current) => togglePermission(current, permission));
            setDirty(true);
          }}
        />
      </div>

      {editing ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#e1e7f1] px-4 py-2.5">
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            type="button"
            onClick={() => {
              setDraftPermissions([...role.permissions]);
              setDirty(false);
              setEditing(false);
            }}
          >
            {tUp("dialogs.cancel")}
          </button>
          <button
            className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
            type="button"
            onClick={() => {
              onSavePermissions(draftPermissions);
              setDirty(false);
              setEditing(false);
            }}
          >
            {tUp("permissions.save")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
