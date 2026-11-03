"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { FormSheet } from "@/components/forms/form-sheet";

import type { Company, DataScope, Role } from "../types";

type InviteForm = {
  email: string;
  name: string;
  roleId: string;
  dataScope: DataScope;
  companyIds: string[];
};

export function InviteUserDialog({
  open,
  roles,
  companies,
  onClose,
}: {
  open: boolean;
  roles: Role[];
  companies: Company[];
  onClose: () => void;
}) {
  const t = useTranslations("usersPermissions");
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<InviteForm>({
    email: "",
    name: "",
    roleId: roles[0]?.id ?? "sales",
    dataScope: "OWN",
    companyIds: companies[0] ? [companies[0].id] : [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof InviteForm, string>>>({});

  useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  function toggleCompany(companyId: string) {
    setForm((current) => {
      const exists = current.companyIds.includes(companyId);
      return {
        ...current,
        companyIds: exists
          ? current.companyIds.filter((id) => id !== companyId)
          : [...current.companyIds, companyId],
      };
    });
  }

  function submit() {
    const nextErrors: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = t("invite.errors.email");
    }
    if (!form.roleId) nextErrors.roleId = t("invite.errors.role");
    if (!form.dataScope) nextErrors.dataScope = t("invite.errors.scope");
    if (form.dataScope !== "TENANT" && form.companyIds.length === 0) {
      nextErrors.companyIds = t("invite.errors.companies");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onClose();
  }

  return (
    <FormSheet
      closeLabel={t("dialogs.close")}
      description={t("invite.body")}
      open={open}
      title={t("invite.title")}
      widthClassName="sm:max-w-[480px]"
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
            {t("invite.submit")}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[#7a899e] uppercase">
            {t("invite.email")}
          </h3>
          <Field error={errors.email} id="invite-email" label={t("invite.email")} required>
            <input
              ref={firstFieldRef}
              aria-invalid={errors.email ? true : undefined}
              className={inputClass(Boolean(errors.email))}
              id="invite-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </Field>

          <Field id="invite-name" label={t("invite.name")}>
            <input
              className={inputClass(false)}
              id="invite-name"
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
        </section>

        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[#7a899e] uppercase">
            {t("invite.role")}
          </h3>
          <Field error={errors.roleId} id="invite-role" label={t("invite.role")} required>
            <select
              className={inputClass(Boolean(errors.roleId))}
              id="invite-role"
              value={form.roleId}
              onChange={(event) => {
                const role = roles.find((entry) => entry.id === event.target.value);
                setForm((current) => ({
                  ...current,
                  roleId: event.target.value,
                  dataScope: role?.defaultScope ?? current.dataScope,
                }));
              }}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {t(role.nameKey)}
                </option>
              ))}
            </select>
          </Field>

          <Field error={errors.dataScope} id="invite-scope" label={t("invite.scope")} required>
            <select
              className={inputClass(Boolean(errors.dataScope))}
              id="invite-scope"
              value={form.dataScope}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dataScope: event.target.value as DataScope,
                }))
              }
            >
              <option value="OWN">{t("scope.OWN")}</option>
              <option value="COMPANY">{t("scope.COMPANY")}</option>
              <option value="TENANT">{t("scope.TENANT")}</option>
            </select>
          </Field>

          {form.dataScope !== "TENANT" ? (
            <fieldset>
              <legend className="mb-1.5 text-[11px] font-medium text-[#5f6f88]">
                {t("invite.companies")}
                <span className="text-[#8e2a26]"> *</span>
              </legend>
              <div className="space-y-1.5 rounded-[12px] border border-[#dfe6f1] p-2">
                {companies.map((company) => {
                  const checked = form.companyIds.includes(company.id);
                  return (
                    <label
                      className="flex min-h-10 items-center gap-2 rounded-[10px] px-2 hover:bg-[#f4f8ff]"
                      key={company.id}
                    >
                      <input
                        checked={checked}
                        className="h-4 w-4 accent-[#044ce2]"
                        type="checkbox"
                        onChange={() => toggleCompany(company.id)}
                      />
                      <span className="text-sm text-[#24334c]">{company.name}</span>
                    </label>
                  );
                })}
              </div>
              {errors.companyIds ? (
                <span className="mt-1.5 block text-xs text-[#8e2a26]">{errors.companyIds}</span>
              ) : null}
            </fieldset>
          ) : (
            <p className="text-[12px] text-[#7a899e]">{t("invite.tenantHint")}</p>
          )}
        </section>
      </div>
    </FormSheet>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
        {label}
        {required ? <span className="text-[#8e2a26]"> *</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1.5 block text-xs text-[#8e2a26]">{error}</span> : null}
    </label>
  );
}

function inputClass(invalid: boolean) {
  return `h-10 w-full rounded-[10px] border bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30 ${
    invalid ? "border-[#c9564f]" : "border-[#dfe6f1]"
  }`;
}
