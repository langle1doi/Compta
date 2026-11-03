"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { PERMISSION_MODULES, roleHasPermission, usedCapabilities } from "../permissions";
import type { PermissionId, Role } from "../types";

export function PermissionMatrix({
  roles,
  selectedRoleId,
}: {
  roles: Role[];
  selectedRoleId: string;
}) {
  const t = useTranslations("usersPermissions");
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  const [compareRoleId, setCompareRoleId] = useState<string>("business-owner");
  const compareRole = roles.find((role) => role.id === compareRoleId);
  const columns = useMemo(() => usedCapabilities(), []);

  if (!selectedRole) return null;

  return (
    <section
      aria-labelledby="permission-matrix-title"
      className="dashboard-card dashboard-enter flex min-w-0 flex-col overflow-hidden"
    >
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <h3 className="dashboard-card-title" id="permission-matrix-title">
            {t("matrix.title")}
          </h3>
          <p className="mt-1 text-[12px] text-[#7a899e]">
            {t("matrix.forRole", { role: t(selectedRole.nameKey) })}
          </p>
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[#5f6f88]">
          {t("matrix.compare")}
          <select
            className="h-10 min-w-[180px] rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/35"
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
      </div>

      <p className="border-t border-[rgb(217_227_238/0.72)] px-4 py-2 text-[11px] leading-4 text-[#7a899e]">
        {t("matrix.immutableNote")}
      </p>

      <div className="dashboard-scroll overflow-x-auto border-t border-[rgb(217_227_238/0.72)]">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-[rgba(247,250,253,0.96)]">
              <th className="sticky left-0 z-[1] bg-[rgba(247,250,253,0.98)] px-4 py-2.5 text-[11px] font-medium text-[#75849b]">
                {t("matrix.module")}
              </th>
              {columns.map((capability) => (
                <th
                  className="px-2 py-2.5 text-center text-[11px] font-medium text-[#75849b]"
                  key={capability}
                >
                  {t(`capabilities.${capability}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((module) => {
              const byCap = new Map(
                module.capabilities.map((entry) => [entry.capability, entry]),
              );
              return (
                <tr
                  className="border-t border-[rgb(220_229_239/0.7)] hover:bg-[rgb(237_244_251/0.45)]"
                  key={module.id}
                >
                  <th
                    className="sticky left-0 z-[1] bg-white px-4 py-2.5 text-left text-[12px] font-semibold text-[#1b2d47]"
                    scope="row"
                  >
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate">{t(module.labelKey)}</span>
                      {module.phase === 2 ? (
                        <span className="rounded-[5px] bg-[#edf2f7] px-1.5 py-0.5 text-[9px] font-semibold text-[#65758d]">
                          {t("matrix.phase2")}
                        </span>
                      ) : null}
                    </span>
                  </th>
                  {columns.map((capability) => {
                    const entry = byCap.get(capability);
                    if (!entry) {
                      return (
                        <td className="px-2 py-2.5 text-center text-[#b7c3d4]" key={capability}>
                          —
                        </td>
                      );
                    }
                    const checked = roleHasPermission(selectedRole, entry.permission);
                    const compareChecked = compareRole
                      ? roleHasPermission(compareRole, entry.permission)
                      : false;
                    const differs = compareRole ? checked !== compareChecked : false;

                    return (
                      <td className="px-2 py-2.5 text-center" key={capability}>
                        <MatrixCheck
                          checked={checked}
                          differs={differs}
                          disabled={selectedRole.system || module.phase === 2}
                          label={`${t(module.labelKey)} · ${t(`capabilities.${capability}`)}`}
                          permission={entry.permission}
                          sensitive={entry.sensitive}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MatrixCheck({
  checked,
  differs,
  disabled,
  label,
  permission,
  sensitive,
}: {
  checked: boolean;
  differs: boolean;
  disabled: boolean;
  label: string;
  permission: PermissionId;
  sensitive?: boolean;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-[8px]",
        differs && "ring-1 ring-[#c9b06a]/50",
        sensitive && checked && "bg-[#fff4e6]",
      )}
      title={permission}
    >
      <span className="sr-only">{label}</span>
      <input
        checked={checked}
        className="h-4 w-4 accent-[#044ce2]"
        disabled={disabled}
        type="checkbox"
        onChange={() => {
          /* System roles are view-only; custom roles will edit via API later. */
        }}
      />
    </label>
  );
}
