"use client";

import { Check, ChevronDown, Minus } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { groupCrudActions, roleHasPermission } from "../permissions";
import type { Capability, PermissionGroup, PermissionId, Role } from "../types";

const CRUD_ORDER: Capability[] = ["create", "read", "update", "delete"];

export function PermissionAccordion({
  groups,
  selectedRole,
  compareRole,
  expandedIds,
  editing,
  draftPermissions,
  onToggleExpanded,
  onTogglePermission,
}: {
  groups: PermissionGroup[];
  selectedRole: Role;
  compareRole: Role | null;
  expandedIds: string[];
  editing: boolean;
  draftPermissions: PermissionId[];
  onToggleExpanded: (groupId: string) => void;
  onTogglePermission: (permission: PermissionId) => void;
}) {
  const t = useTranslations("usersPermissions");

  if (groups.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-[#7a899e]">{t("permissions.emptySearch")}</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="hidden min-w-0 items-center gap-2 px-1 sm:grid sm:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(52px,68px))_minmax(0,1fr)] sm:gap-2">
        <span className="text-[10px] font-semibold tracking-[0.04em] text-[#8a97ab] uppercase">
          {t("matrix.module")}
        </span>
        {CRUD_ORDER.map((capability) => (
          <span
            className="text-center text-[10px] font-semibold tracking-[0.04em] text-[#8a97ab] uppercase"
            key={capability}
          >
            {t(`capabilities.${capability}`)}
          </span>
        ))}
        <span className="text-[10px] font-semibold tracking-[0.04em] text-[#8a97ab] uppercase">
          {t("permissions.extra")}
        </span>
      </div>

      {groups.map((group) => {
        const expanded = expandedIds.includes(group.id);
        const { crudColumns, extra } = groupCrudActions(group.actions);
        const hasExtra = extra.length > 0;

        return (
          <div
            className="overflow-hidden rounded-[12px] border border-[#e4ebf4] bg-[rgb(255_255_255/0.72)]"
            key={group.id}
          >
            <div className="grid min-w-0 gap-2.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(52px,68px))_minmax(0,1fr)] sm:items-center sm:gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-start gap-2">
                  {hasExtra ? (
                    <button
                      aria-expanded={expanded}
                      aria-label={`${t(group.labelKey)} · ${t("permissions.extra")}`}
                      className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[#7a899e] hover:bg-[#f1f5fb]"
                      type="button"
                      onClick={() => onToggleExpanded(group.id)}
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "h-4 w-4 transition-transform duration-160",
                          expanded && "rotate-180",
                        )}
                      />
                    </button>
                  ) : (
                    <span aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="text-[13px] font-semibold text-[#1b2d47]">{t(group.labelKey)}</p>
                      {group.phase === 2 ? (
                        <span className="rounded-[5px] bg-[#edf2f7] px-1.5 py-0.5 text-[9px] font-semibold text-[#65758d]">
                          {t("matrix.phase2")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#7a899e]">
                      {t(group.descriptionKey)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-4 gap-1.5 sm:hidden">
                  {crudColumns.map(({ capability, action }) => (
                    <CrudCell
                      key={capability}
                      actionLabel={action ? t(action.labelKey) : undefined}
                      allowed={
                        action
                          ? editing
                            ? draftPermissions.includes(action.permission)
                            : roleHasPermission(selectedRole, action.permission)
                          : null
                      }
                      compareAllowed={
                        action && compareRole
                          ? roleHasPermission(compareRole, action.permission)
                          : null
                      }
                      editing={editing && group.phase !== 2 && !!action}
                      label={t(`permissions.crudShort.${capability}`)}
                      title={t(`capabilities.${capability}`)}
                      onToggle={action ? () => onTogglePermission(action.permission) : undefined}
                    />
                  ))}
                </div>
              </div>

              {crudColumns.map(({ capability, action }) => (
                <div
                  className="hidden sm:block"
                  key={`${group.id}-${capability}`}
                  title={action ? t(action.labelKey) : undefined}
                >
                  <CrudCell
                    actionLabel={action ? t(action.labelKey) : undefined}
                    allowed={
                      action
                        ? editing
                          ? draftPermissions.includes(action.permission)
                          : roleHasPermission(selectedRole, action.permission)
                        : null
                    }
                    compareAllowed={
                      action && compareRole
                        ? roleHasPermission(compareRole, action.permission)
                        : null
                    }
                    editing={editing && group.phase !== 2 && !!action}
                    label={t(`permissions.crudShort.${capability}`)}
                    title={t(`capabilities.${capability}`)}
                    onToggle={action ? () => onTogglePermission(action.permission) : undefined}
                  />
                </div>
              ))}

              <div className="min-w-0">
                {extra.length === 0 ? (
                  <span className="hidden text-[11px] text-[#c5d0e0] sm:inline">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {extra.map((entry) => {
                      const allowed = editing
                        ? draftPermissions.includes(entry.permission)
                        : roleHasPermission(selectedRole, entry.permission);
                      return (
                        <ExtraChip
                          key={entry.id}
                          allowed={allowed}
                          editing={editing && group.phase !== 2}
                          label={t(entry.labelKey)}
                          sensitive={entry.sensitive}
                          onToggle={() => onTogglePermission(entry.permission)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {expanded && hasExtra ? (
              <div className="border-t border-[#e8eef6] px-3 py-2.5">
                <ul className="space-y-1">
                  {extra.map((entry) => {
                    const currentAllowed = editing
                      ? draftPermissions.includes(entry.permission)
                      : roleHasPermission(selectedRole, entry.permission);
                    const compareAllowed = compareRole
                      ? roleHasPermission(compareRole, entry.permission)
                      : null;

                    return (
                      <li
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[8px] px-1 py-1.5 hover:bg-[#f7faff] sm:grid-cols-[minmax(0,1fr)_72px_72px]"
                        key={entry.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-[#24334c]">
                            {t(entry.labelKey)}
                            {entry.sensitive ? (
                              <span className="ml-1.5 text-[9px] font-semibold text-[#b96d24]">
                                {t("matrix.sensitive")}
                              </span>
                            ) : null}
                          </p>
                          {entry.noteKey ? (
                            <p className="mt-0.5 text-[10px] leading-3.5 text-[#8a97ab]">
                              {t(entry.noteKey)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex justify-center">
                          {editing && group.phase !== 2 ? (
                            <input
                              aria-label={t(entry.labelKey)}
                              checked={currentAllowed}
                              className="h-4 w-4 accent-[#044ce2]"
                              type="checkbox"
                              onChange={() => onTogglePermission(entry.permission)}
                            />
                          ) : (
                            <StateMark allowed={currentAllowed} />
                          )}
                        </div>
                        <div className="hidden justify-center sm:flex">
                          {compareAllowed === null ? (
                            <span className="text-[#c5d0e0]">—</span>
                          ) : (
                            <StateMark allowed={compareAllowed} />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CrudCell({
  label,
  title,
  actionLabel,
  allowed,
  compareAllowed,
  editing,
  onToggle,
}: {
  label: string;
  title: string;
  actionLabel?: string;
  allowed: boolean | null;
  compareAllowed: boolean | null;
  editing: boolean;
  onToggle?: () => void;
}) {
  const differs = compareAllowed !== null && compareAllowed !== allowed;

  if (allowed === null) {
    return (
      <div
        className="flex h-9 flex-col items-center justify-center rounded-[8px] bg-[#f4f7fb] text-[11px] font-semibold text-[#c0cad8]"
        title={`${title} · —`}
      >
        <span>{label}</span>
        <span className="text-[#d0d7e2]">—</span>
      </div>
    );
  }

  if (editing && onToggle) {
    return (
      <label
        className={cn(
          "flex h-9 cursor-pointer flex-col items-center justify-center rounded-[8px] border text-[11px] font-semibold",
          allowed
            ? "border-[#c9d9ff] bg-[#e7efff] text-[#044ce2]"
            : "border-[#e4ebf4] bg-white text-[#7a899e]",
          differs && "ring-1 ring-[#c9b06a]/50",
        )}
        title={actionLabel ?? title}
      >
        <span>{label}</span>
        <input
          checked={allowed}
          className="h-3.5 w-3.5 accent-[#044ce2]"
          type="checkbox"
          onChange={onToggle}
        />
      </label>
    );
  }

  return (
    <div
      className={cn(
        "flex h-9 flex-col items-center justify-center rounded-[8px] text-[11px] font-semibold",
        allowed ? "bg-[#e7efff] text-[#044ce2]" : "bg-[#f4f7fb] text-[#9aa8bc]",
        differs && "ring-1 ring-[#c9b06a]/50",
      )}
      title={actionLabel ?? title}
    >
      <span>{label}</span>
      {allowed ? (
        <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
      ) : (
        <Minus aria-hidden="true" className="h-3.5 w-3.5" />
      )}
    </div>
  );
}

function ExtraChip({
  label,
  allowed,
  editing,
  sensitive,
  onToggle,
}: {
  label: string;
  allowed: boolean;
  editing: boolean;
  sensitive?: boolean;
  onToggle: () => void;
}) {
  if (editing) {
    return (
      <label
        className={cn(
          "inline-flex max-w-full cursor-pointer items-center gap-1 truncate rounded-[6px] border px-1.5 py-0.5 text-[10px] font-semibold",
          allowed
            ? "border-[#c9d9ff] bg-[#e7efff] text-[#044ce2]"
            : "border-[#e4ebf4] bg-white text-[#7a899e]",
          sensitive && allowed && "border-[#f0d2a8] bg-[#fff4e6] text-[#b96d24]",
        )}
        title={label}
      >
        <input
          checked={allowed}
          className="h-3 w-3 shrink-0 accent-[#044ce2]"
          type="checkbox"
          onChange={onToggle}
        />
        <span className="truncate">{label}</span>
      </label>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold",
        allowed ? "bg-[#e7efff] text-[#044ce2]" : "bg-[#f1f4f8] text-[#9aa8bc]",
        sensitive && allowed && "bg-[#fff4e6] text-[#b96d24]",
      )}
      title={label}
    >
      {allowed ? (
        <Check aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2.4} />
      ) : (
        <Minus aria-hidden="true" className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

function StateMark({ allowed }: { allowed: boolean }) {
  if (!allowed) {
    return <Minus aria-hidden="true" className="h-3.5 w-3.5 text-[#c5d0e0]" />;
  }
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#e7efff] text-[#044ce2]">
      <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
    </span>
  );
}
