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
import { useMemo, useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";
import { StatusBadge } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";
import type { Tone } from "@/mocks/dashboard/types";

import { filterPermissionGroups, PERMISSION_GROUPS } from "../permissions";
import type { PermissionId, Role, RoleDetailTab } from "../types";
import { PermissionAccordion } from "./permission-accordion";

export const ROLE_DETAIL_TABS_LAYOUT_ID = "compte-role-detail-tabs";

const roleVisual: Record<string, { icon: LucideIcon; tone: Tone }> = {
  "tenant-admin": { icon: Shield, tone: "purple" },
  "business-owner": { icon: BriefcaseBusiness, tone: "blue" },
  accountant: { icon: Calculator, tone: "green" },
  sales: { icon: UserRound, tone: "orange" },
  viewer: { icon: Eye, tone: "slate" },
};

const detailTabs: RoleDetailTab[] = ["matrix", "settings", "description"];

export function RolesPermissionsPanel({
  roles,
  selectedRoleId,
  onSelectRole,
  onCreateRole,
}: {
  roles: Role[];
  selectedRoleId: string;
  onSelectRole: (roleId: string) => void;
  onCreateRole: () => void;
}) {
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  if (!selectedRole) return null;

  return (
    <RolesPermissionsPanelInner
      key={selectedRole.id}
      roles={roles}
      selectedRole={selectedRole}
      onCreateRole={onCreateRole}
      onSelectRole={onSelectRole}
    />
  );
}

function RolesPermissionsPanelInner({
  roles,
  selectedRole,
  onSelectRole,
  onCreateRole,
}: {
  roles: Role[];
  selectedRole: Role;
  onSelectRole: (roleId: string) => void;
  onCreateRole: () => void;
}) {
  const t = useTranslations("usersPermissions");
  const [detailTab, setDetailTab] = useState<RoleDetailTab>("matrix");
  const [compareRoleId, setCompareRoleId] = useState("business-owner");
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>(["company"]);
  const [editing, setEditing] = useState(false);
  const [draftPermissions, setDraftPermissions] = useState<PermissionId[]>([
    ...selectedRole.permissions,
  ]);
  const [dirty, setDirty] = useState(false);

  const compareRole =
    roles.find((role) => role.id === compareRoleId && role.id !== selectedRole.id) ?? null;

  const filteredGroups = useMemo(
    () => filterPermissionGroups(PERMISSION_GROUPS, query),
    [query],
  );

  const allExpanded = filteredGroups.every((group) => expandedIds.includes(group.id));

  function requestRoleChange(nextRoleId: string) {
    if (dirty && !window.confirm(t("permissions.discardConfirm"))) return;
    onSelectRole(nextRoleId);
  }

  function requestTabChange(next: RoleDetailTab) {
    if (dirty && next !== "matrix" && !window.confirm(t("permissions.discardConfirm"))) return;
    if (dirty && next !== "matrix") {
      setEditing(false);
      setDirty(false);
      setDraftPermissions([...selectedRole.permissions]);
    }
    setDetailTab(next);
  }

  return (
    <section
      aria-labelledby="roles-panel-title"
      className="dashboard-card dashboard-enter flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <div className="shrink-0 px-4 pt-3.5 pb-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="dashboard-card-title" id="roles-panel-title">
              {t("roles.panelTitle")}
            </h3>
            <p className="mt-1 max-w-[48ch] text-[12px] leading-5 text-[#7a899e]">
              {t("roles.panelSubtitle")}
            </p>
          </div>
          <button
            className="action-motion soft-button inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            type="button"
            onClick={onCreateRole}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t("roles.createCustom")}
          </button>
        </div>

        <div className="dashboard-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
          {roles.map((role) => {
            const selected = role.id === selectedRole.id;
            const visual = roleVisual[role.id] ?? { icon: Shield, tone: "blue" as Tone };
            const Icon = visual.icon;
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "relative flex w-[148px] shrink-0 flex-col rounded-[12px] border px-3 py-2.5 text-left transition-colors duration-150",
                  selected
                    ? "border-[#044ce2]/45 bg-[#f2f6ff]"
                    : "border-[#e4ebf4] bg-white hover:border-[#c9d7ef]",
                )}
                key={role.id}
                type="button"
                onClick={() => requestRoleChange(role.id)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-[8px]",
                      selected ? "bg-[#e7efff] text-[#044ce2]" : "bg-[#eef3fa] text-[#66758d]",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2 w-2 rounded-full",
                      selected ? "bg-[#044ce2]" : "bg-[#d5deea]",
                    )}
                  />
                </span>
                <span className="mt-2 truncate text-[12px] font-semibold text-[#1b2d47]">
                  {t(role.nameKey)}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[10px] leading-3.5 text-[#7a899e]">
                  {t(role.cardDescriptionKey)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge size="xs" tone={selectedRole.system ? "slate" : "blue"}>
            {selectedRole.system ? t("roles.systemBadge") : t("roles.customBadge")}
          </StatusBadge>
          {dirty ? (
            <span className="rounded-[6px] bg-[#fff4e6] px-2 py-0.5 text-[10px] font-semibold text-[#b96d24]">
              {t("permissions.unsaved")}
            </span>
          ) : null}
        </div>

        <AnimatedSelectionGroup className="mt-3" id="compte-role-detail-tabs">
          <ul className="flex flex-wrap gap-1" role="tablist">
            {detailTabs.map((tab) => {
              const selected = tab === detailTab;
              const label = t(`roleTabs.${tab}`);
              return (
                <li key={tab}>
                  <button
                    aria-selected={selected}
                    className={cn(
                      "dashboard-pill relative h-8 px-3 text-[11px]",
                      selected && "dashboard-pill--indicator-active",
                    )}
                    role="tab"
                    type="button"
                    onClick={() => requestTabChange(tab)}
                  >
                    {selected ? (
                      <AnimatedActiveIndicator
                        layoutId={ROLE_DETAIL_TABS_LAYOUT_ID}
                        variant="soft-pill"
                      />
                    ) : null}
                    <span className="relative z-[1]">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </AnimatedSelectionGroup>
      </div>

      <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto border-t border-[rgb(217_227_238/0.72)] px-4 py-3">
        {detailTab === "matrix" ? (
          <div className="space-y-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-[#5f6f88]">
                {t("permissions.compare")}
                <select
                  className="h-9 min-w-[150px] rounded-[10px] border border-[#dfe6f1] bg-white px-2.5 text-[12px] text-[#063586]"
                  value={compareRoleId}
                  onChange={(event) => setCompareRoleId(event.target.value)}
                >
                  {roles
                    .filter((role) => role.id !== selectedRole.id)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {t(role.nameKey)}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="soft-button h-9 rounded-[10px] px-3 text-[12px] font-semibold text-[#506078]"
                type="button"
                onClick={() => {
                  setDraftPermissions([...selectedRole.permissions]);
                  setDirty(false);
                  setEditing(false);
                }}
              >
                {t("permissions.reset")}
              </button>
              <label className="relative min-w-0 flex-1 basis-[160px]">
                <span className="sr-only">{t("permissions.search")}</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#8a97ab]"
                />
                <input
                  className="compte-search-input h-9 w-full rounded-[10px] border border-[#dfe6f1] bg-white pr-3 pl-8 text-[12px] text-[#063586] outline-none"
                  placeholder={t("permissions.search")}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                className="soft-button h-9 rounded-[10px] px-3 text-[12px] font-semibold text-[#506078]"
                type="button"
                onClick={() =>
                  setExpandedIds(
                    allExpanded ? [] : filteredGroups.map((group) => group.id),
                  )
                }
              >
                {allExpanded ? t("permissions.collapseAll") : t("permissions.expandAll")}
              </button>
              {!editing ? (
                <button
                  className="soft-primary h-9 rounded-[10px] px-3 text-[12px] font-semibold text-white"
                  type="button"
                  onClick={() => setEditing(true)}
                >
                  {t("permissions.edit")}
                </button>
              ) : null}
            </div>

            <p className="text-[11px] leading-4 text-[#7a899e]">{t("matrix.immutableNote")}</p>

            <PermissionAccordion
              compareRole={compareRole}
              draftPermissions={draftPermissions}
              editing={editing}
              expandedIds={expandedIds}
              groups={filteredGroups}
              selectedRole={selectedRole}
              onToggleExpanded={(groupId) =>
                setExpandedIds((current) =>
                  current.includes(groupId)
                    ? current.filter((id) => id !== groupId)
                    : [...current, groupId],
                )
              }
              onTogglePermission={(permission) => {
                setDraftPermissions((current) => {
                  const next = current.includes(permission)
                    ? current.filter((id) => id !== permission)
                    : [...current, permission];
                  setDirty(true);
                  return next;
                });
              }}
            />
          </div>
        ) : null}

        {detailTab === "settings" ? (
          <div className="space-y-3 text-sm">
            <Field
              label={
                selectedRole.system
                  ? `${t("roleSettings.name")} (${t("roleSettings.locked")})`
                  : t("roleSettings.name")
              }
              value={t(selectedRole.nameKey)}
            />
            <Field label={t("roleSettings.description")} value={t(selectedRole.descriptionKey)} />
            <Field label={t("roleSettings.scope")} value={t(`scope.${selectedRole.defaultScope}`)} />
            <Field
              label={t("roleSettings.type")}
              value={selectedRole.system ? t("roles.systemBadge") : t("roles.customBadge")}
            />
          </div>
        ) : null}

        {detailTab === "description" ? (
          <div className="space-y-3 text-sm leading-6 text-[#405069]">
            <p>{t(selectedRole.descriptionKey)}</p>
            <p>
              <span className="font-semibold text-[#1b2d47]">{t("roleSettings.scope")}: </span>
              {t(`scope.${selectedRole.defaultScope}`)} — {t(`scope.desc.${selectedRole.defaultScope}`)}
            </p>
            <p className="text-[12px] text-[#7a899e]">{t("roleSettings.note")}</p>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t border-[#e1e7f1] bg-[rgb(250_253_255/0.94)] px-4 py-2.5 backdrop-blur-sm">
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            type="button"
            onClick={() => {
              setDraftPermissions([...selectedRole.permissions]);
              setDirty(false);
              setEditing(false);
            }}
          >
            {t("editUser.cancel")}
          </button>
          <button
            className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
            type="button"
            onClick={() => {
              setDirty(false);
              setEditing(false);
            }}
          >
            {t("permissions.save")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[#e8eef6] px-3 py-2.5">
      <p className="text-[11px] font-medium text-[#7a899e]">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-[#1b2d47]">{value}</p>
    </div>
  );
}
