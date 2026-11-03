"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { SoftSelect } from "@/components/compte/soft-select";
import { FormSheet } from "@/components/forms/form-sheet";

import { PERMISSION_MODULES } from "../permissions";
import { backendCodeFor } from "../permission-map";
import { togglePermission } from "../settings-service";
import type { DataScope, PermissionId } from "../types";

export type CreateRolePayload = {
  name: string;
  description: string;
  scope: DataScope;
  permissions: PermissionId[];
};

export function CreateRoleDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateRolePayload) => void;
}) {
  const t = useTranslations("usersPermissions");
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<DataScope>("COMPANY");
  const [selected, setSelected] = useState<PermissionId[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => nameRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function toggle(permission: PermissionId) {
    setSelected((current) => togglePermission(current, permission));
  }

  function submit() {
    if (!name.trim()) {
      setError(t("createRole.errors.name"));
      return;
    }
    setError(undefined);
    onCreate({
      name: name.trim(),
      description: description.trim(),
      scope,
      permissions: selected,
    });
  }

  return (
    <FormSheet
      closeLabel={t("dialogs.close")}
      description={t("createRole.body")}
      open={open}
      title={t("createRole.title")}
      widthClassName="sm:max-w-[520px]"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            type="button"
            onClick={onClose}
          >
            {t("dialogs.cancel")}
          </button>
          <button
            className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
            type="button"
            onClick={submit}
          >
            {t("createRole.submit")}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[#7a899e] uppercase">
            {t("roleSettings.name")}
          </h3>
          <label className="block" htmlFor="role-name">
            <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
              {t("createRole.name")}
              <span className="text-[#8e2a26]"> *</span>
            </span>
            <input
              ref={nameRef}
              className={`h-10 w-full rounded-[10px] border bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30 ${
                error ? "border-[#c9564f]" : "border-[#dfe6f1]"
              }`}
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {error ? (
              <span className="mt-1.5 block text-xs text-[#8e2a26]">{error}</span>
            ) : null}
          </label>

          <label className="block" htmlFor="role-description">
            <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
              {t("createRole.description")}
            </span>
            <textarea
              className="min-h-[72px] w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 py-2 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30"
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <SoftSelect
            label={t("createRole.scope")}
            options={[
              { value: "OWN", label: t("scope.OWN") },
              { value: "COMPANY", label: t("scope.COMPANY") },
              { value: "TENANT", label: t("scope.TENANT") },
            ]}
            value={scope}
            onChange={(value) => setScope(value as DataScope)}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[#7a899e] uppercase">
            {t("createRole.permissions")}
          </h3>
          <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-[12px] border border-[#e1e7f1] p-3">
            {PERMISSION_MODULES.map((module) => ({
              ...module,
              capabilities: module.capabilities.filter((entry) => backendCodeFor(entry.permission)),
            }))
              .filter((module) => module.phase !== 2 && module.capabilities.length > 0)
              .map((module) => (
                <div key={module.id}>
                  <p className="text-[12px] font-semibold text-[#1b2d47]">
                    {t(module.labelKey)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {module.capabilities.map((entry) => {
                      const checked = selected.includes(entry.permission);
                      return (
                        <label
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border px-2 text-[11px] ${
                            checked
                              ? "border-[#b9d0fb] bg-[#eef4ff] text-[#1456d9]"
                              : "border-[#e1e7f1] bg-white text-[#5f6f88]"
                          }`}
                          key={entry.permission}
                        >
                          <input
                            checked={checked}
                            className="h-3.5 w-3.5 accent-[#044ce2]"
                            type="checkbox"
                            onChange={() => toggle(entry.permission)}
                          />
                          {t(`capabilities.${entry.capability}`)}
                          {entry.sensitive ? (
                            <span className="text-[9px] font-semibold text-[#b96d24]">
                              {t("matrix.sensitive")}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </FormSheet>
  );
}
