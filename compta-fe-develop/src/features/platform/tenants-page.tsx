"use client";

import { Building2, LogOut, Plus, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ApiErrorState } from "@/components/compte/api-error-state";
import { ConfirmDialog } from "@/components/compte/confirm-dialog";
import { SoftToast } from "@/components/compte/soft-toast";
import { StatusBadge } from "@/components/dashboard/tone";
import { FormSheet } from "@/components/forms/form-sheet";
import { ApiError } from "@/lib/api/client";
import { useApiErrorMessage } from "@/lib/api/use-api-error";
import { useSubmitLock } from "@/lib/use-submit-lock";
import type { Tone } from "@/mocks/dashboard/types";

import {
  TENANT_FIELD_TO_DRAFT,
  useTenants,
  type Tenant,
  type TenantDraft,
  type TenantStatus,
} from "./tenants-service";

const STATUS_TONE: Record<TenantStatus, Tone> = {
  PROVISIONING: "blue",
  ACTIVE: "green",
  SUSPENDED: "orange",
  FAILED: "red",
  DELETED: "slate",
};

const PASSWORD_MIN_LENGTH = 12;
const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
// The backend has no plan list; these are the plans of its seed data.
const PLAN_CODES = ["starter", "business"];

const emptyDraft: TenantDraft = {
  name: "",
  subdomain: "",
  planCode: "",
  companyLegalName: "",
  companyCountryCode: "FR",
  companyCurrency: "EUR",
  adminEmail: "",
  adminFullName: "",
  adminPassword: "",
};

const inputClass =
  "h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30 disabled:bg-[#f7fafd] disabled:text-[#66758d]";

async function signOut() {
  await fetch("/api/platform/auth/logout", { method: "POST" }).catch(
    () => undefined,
  );
  window.location.assign(
    `/${window.location.pathname.split("/")[1] || "fr"}/login`,
  );
}

export function TenantsPage() {
  const t = useTranslations("platform");
  const locale = useLocale();
  const { message } = useApiErrorMessage();
  const { list, create, setStatus, retry } = useTenants();
  const lock = useSubmitLock();
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [suspending, setSuspending] = useState<{
    tenant: Tenant;
    status: "SUSPENDED" | "DELETED";
  } | null>(null);
  const [activating, setActivating] = useState<Tenant | null>(null);
  const [retrying, setRetrying] = useState<Tenant | null>(null);
  const [activateError, setActivateError] = useState("");
  const [notice, setNotice] = useState("");

  const tenants = list.data ?? [];

  function actionsFor(tenant: Tenant) {
    const className =
      "action-motion soft-button inline-flex min-h-10 items-center justify-center rounded-[10px] px-3 text-xs font-semibold";
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {tenant.status === "ACTIVE" ? (
          <button
            className={`${className} text-[#b96d24]`}
            type="button"
            onClick={() => setSuspending({ tenant, status: "SUSPENDED" })}
          >
            {t("actions.suspend")}
          </button>
        ) : null}
        {tenant.status === "SUSPENDED" ? (
          <>
            <button
              className={`${className} text-[#0f8a5f]`}
              type="button"
              onClick={() => {
                setActivateError("");
                setActivating(tenant);
              }}
            >
              {t("actions.activate")}
            </button>
            <button
              className={`${className} text-[#c9564f]`}
              type="button"
              onClick={() => setSuspending({ tenant, status: "DELETED" })}
            >
              {t("actions.delete")}
            </button>
          </>
        ) : null}
        {tenant.status === "FAILED" ? (
          <button
            className={`${className} gap-1.5 text-[#044ce2]`}
            type="button"
            onClick={() => setRetrying(tenant)}
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            {t("actions.retry")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <main className="dashboard-canvas flex h-dvh min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-[#f3f4f6]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#d1d5db]/70 bg-[rgb(243_244_246/0.8)] px-3 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo className="h-8 w-auto shrink-0" />
          <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[#063586] sm:text-[22px]">
            {t("title")}
          </h1>
        </div>
        <button
          className="action-motion soft-button inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-[#b42318]"
          type="button"
          onClick={() => void signOut()}
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {t("signOut")}
        </button>
      </header>

      <div className="dashboard-page flex min-w-0 flex-1 flex-col">
        <section className="dashboard-card dashboard-list flex min-w-0 flex-col overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#edf2f8] px-3.5 py-3">
            <div className="min-w-0">
              <h2 className="dashboard-card-title text-[15px]">
                {t("list.title")}
              </h2>
              <p className="mt-0.5 text-[11px] leading-4 text-[#7d8aa0]">
                {t("list.subtitle")}
              </p>
            </div>
            <button
              className="action-motion soft-primary inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold text-white"
              type="button"
              onClick={() => {
                setCreateKey((value) => value + 1);
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {t("create.open")}
            </button>
          </div>

          {list.isError ? (
            <>
              <ApiErrorState error={list.error} />
              <div className="flex justify-center pb-8">
                <button
                  className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
                  type="button"
                  onClick={() => void list.refetch()}
                >
                  {t("list.reload")}
                </button>
              </div>
            </>
          ) : list.isLoading ? (
            <p className="px-6 py-12 text-center text-xs text-[#7d8aa0]">
              {t("list.loading")}
            </p>
          ) : tenants.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Building2
                aria-hidden="true"
                className="h-8 w-8 text-[#b7c3d6]"
              />
              <p className="text-sm font-semibold text-[#24334c]">
                {t("list.empty")}
              </p>
            </div>
          ) : (
            <>
              <div className="dashboard-scroll hidden min-w-0 overflow-x-auto md:block">
                <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
                  <thead className="dashboard-list__head">
                    <tr>
                      <th>{t("columns.name")}</th>
                      <th>{t("columns.subdomain")}</th>
                      <th>{t("columns.status")}</th>
                      <th>{t("columns.plan")}</th>
                      <th>{t("columns.createdAt")}</th>
                      <th>{t("columns.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => (
                      <tr
                        className="dashboard-list__row"
                        data-tenant={tenant.subdomain}
                        key={tenant.id}
                      >
                        <td className="max-w-[260px]">
                          <span
                            className="dashboard-list__primary block truncate"
                            title={tenant.name}
                          >
                            {tenant.name}
                          </span>
                          {tenant.failure_reason ? (
                            <span
                              className="mt-0.5 block truncate text-[11px] text-[#c9564f]"
                              title={tenant.failure_reason}
                            >
                              {tenant.failure_reason}
                            </span>
                          ) : null}
                        </td>
                        <td className="text-[12px] text-[#405069]">
                          {tenant.subdomain}
                        </td>
                        <td>
                          <StatusBadge
                            size="xs"
                            tone={STATUS_TONE[tenant.status]}
                          >
                            {t(`status.${tenant.status}`)}
                          </StatusBadge>
                        </td>
                        <td className="text-[12px] text-[#405069]">
                          {tenant.plan.name}
                        </td>
                        <td className="text-[12px] whitespace-nowrap text-[#66758d]">
                          {new Date(tenant.created_at).toLocaleDateString(
                            locale,
                          )}
                        </td>
                        <td>{actionsFor(tenant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[rgb(220_229_239/0.7)] md:hidden">
                {tenants.map((tenant) => (
                  <li className="space-y-2 px-3.5 py-3" key={tenant.id}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold text-[#1b2d47]"
                          title={tenant.name}
                        >
                          {tenant.name}
                        </p>
                        <p className="truncate text-[12px] text-[#7a899e]">
                          {tenant.subdomain}
                        </p>
                      </div>
                      <StatusBadge size="xs" tone={STATUS_TONE[tenant.status]}>
                        {t(`status.${tenant.status}`)}
                      </StatusBadge>
                    </div>
                    <p className="text-[12px] text-[#66758d]">
                      {tenant.plan.name} ·{" "}
                      {new Date(tenant.created_at).toLocaleDateString(locale)}
                    </p>
                    {tenant.failure_reason ? (
                      <p className="text-[12px] break-words text-[#c9564f]">
                        {tenant.failure_reason}
                      </p>
                    ) : null}
                    {actionsFor(tenant)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <CreateTenantSheet
        key={createKey}
        create={create}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(tenant) => {
          setCreateOpen(false);
          setNotice(t("create.done", { name: tenant.name }));
        }}
      />

      {suspending ? (
        <ConfirmByNameSheet
          key={`${suspending.tenant.id}-${suspending.status}`}
          status={suspending.status}
          submit={setStatus}
          tenant={suspending.tenant}
          onClose={() => setSuspending(null)}
        />
      ) : null}

      {retrying ? (
        <RetrySheet
          key={retrying.id}
          retry={retry}
          tenant={retrying}
          onClose={() => setRetrying(null)}
        />
      ) : null}

      <ConfirmDialog
        body={
          activating ? t("activate.body", { name: activating.name }) : undefined
        }
        cancelLabel={t("cancel")}
        confirmLabel={t("actions.activate")}
        confirming={setStatus.isPending}
        error={activateError || null}
        open={activating !== null}
        title={t("activate.title")}
        onCancel={() => setActivating(null)}
        onConfirm={() => {
          if (!activating) return;
          const { id } = activating;
          void lock(async () => {
            try {
              await setStatus.mutateAsync({ id, status: "ACTIVE" });
              setActivating(null);
            } catch (caught) {
              setActivateError(message(caught));
            }
          });
        }}
      />

      {notice ? (
        <SoftToast
          message={notice}
          tone="success"
          onDismiss={() => setNotice("")}
        />
      ) : null}
    </main>
  );
}

function CreateTenantSheet({
  open,
  create,
  onClose,
  onCreated,
}: {
  open: boolean;
  create: ReturnType<typeof useTenants>["create"];
  onClose: () => void;
  onCreated: (tenant: Tenant) => void;
}) {
  const t = useTranslations("platform");
  const { message, fieldMessage } = useApiErrorMessage();
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<
    Partial<Record<keyof TenantDraft, string>>
  >({});
  const [formError, setFormError] = useState("");
  const lock = useSubmitLock();
  const pending = create.isPending;

  function validate() {
    const next: Partial<Record<keyof TenantDraft, string>> = {};
    if (!draft.name.trim()) next.name = t("create.errors.required");
    if (!SUBDOMAIN_RE.test(draft.subdomain.trim()))
      next.subdomain = t("create.errors.subdomain");
    if (!draft.companyLegalName.trim())
      next.companyLegalName = t("create.errors.required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.adminEmail.trim())) {
      next.adminEmail = t("create.errors.email");
    }
    if (!draft.adminFullName.trim())
      next.adminFullName = t("create.errors.required");
    if (draft.adminPassword.length < PASSWORD_MIN_LENGTH) {
      next.adminPassword = t("create.errors.password", {
        min: PASSWORD_MIN_LENGTH,
      });
    }
    return next;
  }

  function submit() {
    const next = validate();
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length > 0) return;

    void lock(async () => {
      try {
        onCreated(await create.mutateAsync(draft));
      } catch (caught) {
        const fieldErrors: Partial<Record<keyof TenantDraft, string>> = {};
        for (const field of caught instanceof ApiError ? caught.fields : []) {
          const key = TENANT_FIELD_TO_DRAFT[field.field];
          if (key && !fieldErrors[key]) fieldErrors[key] = fieldMessage(field);
        }
        setErrors(fieldErrors);
        setFormError(message(caught));
      }
    });
  }

  function field(
    key: keyof TenantDraft,
    label: string,
    options?: {
      type?: string;
      hint?: string;
      autoComplete?: string;
      lowercase?: boolean;
    },
  ) {
    return (
      <label className="block min-w-0" htmlFor={`tenant-${key}`}>
        <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
          {label}
        </span>
        <input
          aria-invalid={Boolean(errors[key])}
          autoComplete={options?.autoComplete}
          className={inputClass}
          disabled={pending}
          id={`tenant-${key}`}
          type={options?.type ?? "text"}
          value={draft[key]}
          onChange={(event) => {
            const value = options?.lowercase
              ? event.target.value.toLowerCase()
              : event.target.value;
            setDraft({ ...draft, [key]: value });
            setErrors({ ...errors, [key]: undefined });
          }}
        />
        {options?.hint ? (
          <span className="mt-1 block text-[11px] text-[#7a899e]">
            {options.hint}
          </span>
        ) : null}
        {errors[key] ? (
          <span className="mt-1 block text-[11px] text-[#c9564f]">
            {errors[key]}
          </span>
        ) : null}
      </label>
    );
  }

  return (
    <FormSheet
      closeLabel={t("cancel")}
      description={t("create.body")}
      open={open}
      title={t("create.title")}
      widthClassName="sm:max-w-[520px]"
      // Provisioning cannot be cancelled: the sheet stays until the backend answers.
      onClose={() => {
        if (!pending) onClose();
      }}
      footer={
        <div className="flex flex-col gap-2 sm:items-end">
          {pending ? (
            <p className="text-xs font-medium text-[#044ce2]" role="status">
              {t("create.pending")}
            </p>
          ) : null}
          {formError ? (
            <p className="text-xs font-medium text-[#c9564f]" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069] disabled:opacity-50"
              disabled={pending}
              type="button"
              onClick={onClose}
            >
              {t("cancel")}
            </button>
            <button
              className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={pending}
              type="button"
              onClick={submit}
            >
              {pending ? t("create.submitting") : t("create.submit")}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {field("name", t("fields.name"))}
        {field("subdomain", t("fields.subdomain"), {
          hint: t("fields.subdomainHint"),
          lowercase: true,
        })}
        <label className="block" htmlFor="tenant-planCode">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
            {t("fields.plan")}
          </span>
          <select
            className={inputClass}
            disabled={pending}
            id="tenant-planCode"
            value={draft.planCode}
            onChange={(event) =>
              setDraft({ ...draft, planCode: event.target.value })
            }
          >
            <option value="">{t("fields.planDefault")}</option>
            {PLAN_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          {errors.planCode ? (
            <span className="mt-1 block text-[11px] text-[#c9564f]">
              {errors.planCode}
            </span>
          ) : null}
        </label>
        {field("companyLegalName", t("fields.companyLegalName"))}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("companyCountryCode", t("fields.companyCountryCode"))}
          {field("companyCurrency", t("fields.companyCurrency"))}
        </div>
        {field("adminEmail", t("fields.adminEmail"), { type: "email" })}
        {field("adminFullName", t("fields.adminFullName"))}
        {field("adminPassword", t("fields.adminPassword"), {
          type: "password",
          autoComplete: "new-password",
          hint: t("fields.adminPasswordHint", { min: PASSWORD_MIN_LENGTH }),
        })}
      </div>
    </FormSheet>
  );
}

/** Suspending or deleting asks for the tenant's name again (F01, UI notes). */
function ConfirmByNameSheet({
  tenant,
  status,
  submit,
  onClose,
}: {
  tenant: Tenant;
  status: "SUSPENDED" | "DELETED";
  submit: ReturnType<typeof useTenants>["setStatus"];
  onClose: () => void;
}) {
  const t = useTranslations("platform");
  const { message } = useApiErrorMessage();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const key = status === "SUSPENDED" ? "suspend" : "delete";

  return (
    <FormSheet
      closeLabel={t("cancel")}
      description={t(`${key}.body`, { name: tenant.name })}
      open
      title={t(`${key}.title`)}
      widthClassName="sm:max-w-[440px]"
      zIndexClassName="z-[110]"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            type="button"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={typed !== tenant.name || submit.isPending}
            type="button"
            onClick={() => {
              setError("");
              void lock(async () => {
                try {
                  await submit.mutateAsync({ id: tenant.id, status });
                  onClose();
                } catch (caught) {
                  setError(message(caught));
                }
              });
            }}
          >
            {t(`actions.${key}`)}
          </button>
        </div>
      }
    >
      <label className="block" htmlFor="tenant-confirm-name">
        <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
          {t("confirmName", { name: tenant.name })}
        </span>
        <input
          autoComplete="off"
          className={inputClass}
          id="tenant-confirm-name"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </label>
      {error ? (
        <p className="mt-3 text-[12px] font-medium text-[#c9564f]" role="alert">
          {error}
        </p>
      ) : null}
    </FormSheet>
  );
}

/** The backend never stores the admin password, so a retry asks for it again. */
function RetrySheet({
  tenant,
  retry,
  onClose,
}: {
  tenant: Tenant;
  retry: ReturnType<typeof useTenants>["retry"];
  onClose: () => void;
}) {
  const t = useTranslations("platform");
  const { message, fieldMessage } = useApiErrorMessage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const pending = retry.isPending;

  return (
    <FormSheet
      closeLabel={t("cancel")}
      description={t("retry.body", { name: tenant.name })}
      open
      title={t("retry.title")}
      widthClassName="sm:max-w-[440px]"
      zIndexClassName="z-[110]"
      onClose={() => {
        if (!pending) onClose();
      }}
      footer={
        <div className="flex justify-end gap-2">
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069] disabled:opacity-50"
            disabled={pending}
            type="button"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={pending}
            type="button"
            onClick={() => {
              if (password.length < PASSWORD_MIN_LENGTH) {
                setError(
                  t("create.errors.password", { min: PASSWORD_MIN_LENGTH }),
                );
                return;
              }
              setError("");
              void lock(async () => {
                try {
                  await retry.mutateAsync({
                    id: tenant.id,
                    adminPassword: password,
                  });
                  onClose();
                } catch (caught) {
                  const field =
                    caught instanceof ApiError ? caught.fields[0] : undefined;
                  setError(field ? fieldMessage(field) : message(caught));
                }
              });
            }}
          >
            {pending ? t("create.submitting") : t("actions.retry")}
          </button>
        </div>
      }
    >
      <label className="block" htmlFor="tenant-retry-password">
        <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
          {t("fields.adminPassword")}
        </span>
        <input
          autoComplete="new-password"
          className={inputClass}
          disabled={pending}
          id="tenant-retry-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {pending ? (
        <p className="mt-3 text-xs font-medium text-[#044ce2]" role="status">
          {t("create.pending")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-[12px] font-medium text-[#c9564f]" role="alert">
          {error}
        </p>
      ) : null}
    </FormSheet>
  );
}
