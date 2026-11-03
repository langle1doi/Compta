"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";

/** Super Admin API. apiFetch adds /api, so these reach the /api/platform proxy. */
export type TenantStatus =
  "PROVISIONING" | "ACTIVE" | "SUSPENDED" | "FAILED" | "DELETED";

export type Tenant = {
  id: string;
  name: string;
  subdomain: string;
  status: TenantStatus;
  failure_reason: string | null;
  plan: { id: string; code: string; name: string };
  created_at: string;
};

export type TenantDraft = {
  name: string;
  subdomain: string;
  planCode: string;
  companyLegalName: string;
  companyCountryCode: string;
  companyCurrency: string;
  adminEmail: string;
  adminFullName: string;
  adminPassword: string;
};

/** Backend field name -> form field, for mapping 422 errors. */
export const TENANT_FIELD_TO_DRAFT: Record<string, keyof TenantDraft> = {
  name: "name",
  subdomain: "subdomain",
  plan_code: "planCode",
  company_legal_name: "companyLegalName",
  company_country_code: "companyCountryCode",
  company_currency: "companyCurrency",
  admin_email: "adminEmail",
  admin_full_name: "adminFullName",
  admin_password: "adminPassword",
};

const QUERY_KEY = ["platform", "tenants"];

export function useTenants() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const list = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      apiFetch<Tenant[]>("/platform/tenants", { withCompany: false }),
  });

  const create = useMutation({
    mutationFn: (draft: TenantDraft) =>
      apiFetch<Tenant>("/platform/tenants", {
        method: "POST",
        withCompany: false,
        body: {
          name: draft.name.trim(),
          subdomain: draft.subdomain.trim(),
          ...(draft.planCode ? { plan_code: draft.planCode } : {}),
          company_legal_name: draft.companyLegalName.trim(),
          ...(draft.companyCountryCode.trim()
            ? {
                company_country_code: draft.companyCountryCode
                  .trim()
                  .toUpperCase(),
              }
            : {}),
          ...(draft.companyCurrency.trim()
            ? { company_currency: draft.companyCurrency.trim().toUpperCase() }
            : {}),
          admin_email: draft.adminEmail.trim(),
          admin_full_name: draft.adminFullName.trim(),
          admin_password: draft.adminPassword,
        },
      }),
    // A failed provisioning still leaves a FAILED tenant to show.
    onSettled: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TenantStatus }) =>
      apiFetch<Tenant>(`/platform/tenants/${id}/status`, {
        method: "PATCH",
        withCompany: false,
        body: { status },
      }),
    onSettled: invalidate,
  });

  const retry = useMutation({
    mutationFn: ({
      id,
      adminPassword,
    }: {
      id: string;
      adminPassword: string;
    }) =>
      apiFetch<Tenant>(`/platform/tenants/${id}/retry`, {
        method: "POST",
        withCompany: false,
        body: { admin_password: adminPassword },
      }),
    onSettled: invalidate,
  });

  return { list, create, setStatus, retry };
}
