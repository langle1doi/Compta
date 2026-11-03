"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";

import { useCan } from "./can";
import {
  BACKEND_TO_FRONTEND,
  backendCodeFor,
  grantsToScopes,
  type BackendGrant,
} from "./permission-map";
import { PERMISSION_GROUPS } from "./permissions";
import { useSession, type ApiCompany } from "./session-provider";
import type {
  Company,
  CompanyStatus,
  DataScope,
  Membership,
  PermissionId,
  Role,
  User,
  UserStatus,
} from "./types";

/** Membership that applies to every company of the tenant (company_id null on the wire). */
export const ALL_COMPANIES = "*";

// ---------------------------------------------------------------- companies

export type CompanyFormDraft = {
  name: string;
  legalName: string;
  currency: string;
  siret: string;
  vatNumber: string;
  naf: string;
  iban: string;
  bic: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
};

export const emptyCompanyFormDraft: CompanyFormDraft = {
  name: "",
  legalName: "",
  currency: "EUR",
  siret: "",
  vatNumber: "",
  naf: "",
  iban: "",
  bic: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
};

/** Backend field name -> form field, for mapping 422 errors. */
export const COMPANY_FIELD_TO_DRAFT: Record<string, keyof CompanyFormDraft> = {
  legal_name: "legalName",
  trade_name: "name",
  currency: "currency",
  siret: "siret",
  vat_number: "vatNumber",
  naf_code: "naf",
  iban: "iban",
  bic: "bic",
  address_line1: "addressLine1",
  address_line2: "addressLine2",
  postal_code: "postalCode",
  city: "city",
};

export type CompanyView = Company & { draft: CompanyFormDraft };

function companyFromApi(company: ApiCompany): CompanyView {
  const status: CompanyStatus =
    company.status === "ACTIVE" ? "ACTIVE" : "ARCHIVED";
  return {
    id: company.id,
    name: company.trade_name || company.legal_name,
    legalName: company.legal_name,
    currency: company.currency,
    status,
    siret: company.siret ?? undefined,
    vatNumber: company.vat_number ?? undefined,
    naf: company.naf_code ?? undefined,
    iban: company.iban ?? undefined,
    bic: company.bic ?? undefined,
    subtitle: company.currency,
    draft: {
      name: company.trade_name ?? "",
      legalName: company.legal_name,
      currency: company.currency,
      siret: company.siret ?? "",
      vatNumber: company.vat_number ?? "",
      naf: company.naf_code ?? "",
      iban: company.iban ?? "",
      bic: company.bic ?? "",
      addressLine1: company.address_line1 ?? "",
      addressLine2: company.address_line2 ?? "",
      postalCode: company.postal_code ?? "",
      city: company.city ?? "",
    },
  };
}

function companyBody(draft: CompanyFormDraft) {
  const values = {
    legal_name: draft.legalName.trim(),
    trade_name: draft.name.trim(),
    currency: draft.currency.trim().toUpperCase(),
    siret: draft.siret.replace(/\s/g, ""),
    vat_number: draft.vatNumber.trim(),
    naf_code: draft.naf.trim(),
    iban: draft.iban.replace(/\s/g, ""),
    bic: draft.bic.trim(),
    address_line1: draft.addressLine1.trim(),
    address_line2: draft.addressLine2.trim(),
    postal_code: draft.postalCode.trim(),
    city: draft.city.trim(),
  };
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value),
  );
}

/**
 * A company-scoped manager is only recognized when the target company is sent as X-Company-Id.
 * Inactive companies refuse the header: only tenant-wide scope can act on them, without it.
 */
function companyTarget(company: Pick<Company, "id" | "status">) {
  return company.status === "ACTIVE"
    ? { companyId: company.id }
    : { withCompany: false };
}

export function useCompanies() {
  const { companies, status } = useSession();
  return {
    companies: companies.map(companyFromApi),
    isLoading: status === "loading",
  };
}

export function useCompanyMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["session", "companies"] });

  const create = useMutation({
    mutationFn: (draft: CompanyFormDraft) =>
      apiFetch("/companies", {
        method: "POST",
        body: companyBody(draft),
        withCompany: false,
      }),
    onSettled: invalidate,
  });
  const update = useMutation({
    mutationFn: ({
      company,
      draft,
    }: {
      company: CompanyView;
      draft: CompanyFormDraft;
    }) =>
      apiFetch(`/companies/${company.id}`, {
        method: "PATCH",
        body: companyBody(draft),
        ...companyTarget(company),
      }),
    onSettled: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: ({
      company,
      status,
    }: {
      company: CompanyView;
      status: CompanyStatus;
    }) =>
      apiFetch(`/companies/${company.id}`, {
        method: "PATCH",
        body: { status: status === "ACTIVE" ? "ACTIVE" : "INACTIVE" },
        ...companyTarget(company),
      }),
    onSettled: invalidate,
  });

  return { create, update, setStatus };
}

export type TaxRate = {
  id: string;
  rate: string;
  label: string;
  legal_mention: string | null;
  is_default: boolean;
  is_active: boolean;
};

export type TaxRateDraft = {
  rate: string;
  label: string;
  legalMention: string;
  isDefault: boolean;
};

export function useTaxRates(company: CompanyView | null) {
  const queryClient = useQueryClient();
  const key = ["tax-rates", company?.id];
  const target = company ? companyTarget(company) : {};
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const list = useQuery({
    queryKey: key,
    enabled: Boolean(company),
    queryFn: () =>
      apiFetch<TaxRate[]>(`/companies/${company?.id}/tax-rates`, target),
  });
  const create = useMutation({
    mutationFn: (draft: TaxRateDraft) =>
      apiFetch(`/companies/${company?.id}/tax-rates`, {
        method: "POST",
        body: {
          rate: draft.rate.trim().replace(",", "."),
          label: draft.label.trim(),
          ...(draft.legalMention.trim()
            ? { legal_mention: draft.legalMention.trim() }
            : {}),
          is_default: draft.isDefault,
        },
        ...target,
      }),
    onSettled: invalidate,
  });
  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { is_default?: boolean; is_active?: boolean };
    }) =>
      apiFetch(`/companies/${company?.id}/tax-rates/${id}`, {
        method: "PATCH",
        body,
        ...target,
      }),
    onSettled: invalidate,
  });

  return { list, create, update };
}

// ---------------------------------------------------------------- roles

type ApiRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  member_count: number;
  grants: BackendGrant[];
};

const SYSTEM_ROLE_I18N: Record<string, string> = {
  tenant_admin: "tenantAdmin",
  owner: "businessOwner",
  accountant: "accountant",
  sales: "sales",
  viewer: "viewer",
};

export type RoleView = Role & {
  key: string;
  memberCount: number;
  grants: BackendGrant[];
};

function mainScope(grants: readonly BackendGrant[]): DataScope {
  const counts = new Map<DataScope, number>();
  for (const grant of grants)
    counts.set(grant.scope, (counts.get(grant.scope) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "COMPANY";
}

function roleFromApi(role: ApiRole): RoleView {
  const i18nKey = role.is_system ? SYSTEM_ROLE_I18N[role.key] : undefined;
  const fallbackKey = `custom.${role.id}`;
  return {
    id: role.id,
    key: role.key,
    nameKey: i18nKey ? `roles.${i18nKey}.name` : `${fallbackKey}.name`,
    descriptionKey: i18nKey
      ? `roles.${i18nKey}.description`
      : `${fallbackKey}.description`,
    cardDescriptionKey: i18nKey
      ? `roles.${i18nKey}.card`
      : `${fallbackKey}.description`,
    label: i18nKey ? undefined : role.name,
    description: i18nKey ? undefined : (role.description ?? role.name),
    defaultScope: mainScope(role.grants),
    permissions: [...grantsToScopes(role.grants).keys()],
    system: role.is_system,
    memberCount: role.member_count,
    grants: role.grants,
  };
}

/** Catalog limited to what the backend can actually store: the rest could not be saved. */
export const BACKEND_PERMISSION_GROUPS = PERMISSION_GROUPS.map((group) => ({
  ...group,
  actions: group.actions.filter((entry) => backendCodeFor(entry.permission)),
})).filter((group) => group.actions.length > 0);

/** One backend grant can stand for several frontend ids, which therefore toggle together. */
export function togglePermission(
  current: readonly PermissionId[],
  permission: PermissionId,
) {
  const code = backendCodeFor(permission);
  const linked = code ? BACKEND_TO_FRONTEND[code] : [permission];
  return current.includes(permission)
    ? current.filter((id) => !linked.includes(id))
    : [...new Set([...current, ...linked])];
}

function toGrants(
  permissions: readonly PermissionId[],
  scope: DataScope,
  existing: readonly BackendGrant[],
) {
  const shown = new Set(
    BACKEND_PERMISSION_GROUPS.flatMap((group) =>
      group.actions.map((entry) => backendCodeFor(entry.permission)),
    ),
  );
  const scopeOf = new Map(
    existing.map((grant) => [`${grant.resource}.${grant.action}`, grant.scope]),
  );
  const codes = new Set(
    permissions.map(backendCodeFor).filter((code) => code !== undefined),
  );
  const selected = [...codes].map((code) => {
    const [resource, action] = code.split(".") as [string, string];
    return { resource, action, scope: scopeOf.get(code) ?? scope };
  });
  // Grants this editor does not display are not the user's to lose.
  const kept = existing.filter(
    (grant) => !shown.has(`${grant.resource}.${grant.action}`),
  );
  return [...selected, ...kept];
}

function roleKeyFrom(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(?:^[^a-z]+)|(?:_+$)/g, "")
    .slice(0, 40);
  // Keys are unique per tenant and two roles may share a display name.
  return `${slug || "role"}_${Date.now().toString(36)}`;
}

export function useRoles() {
  const check = useCan();
  const query = useQuery({
    queryKey: ["roles"],
    enabled: check("role.read"),
    queryFn: async () =>
      (await apiFetch<ApiRole[]>("/roles", { withCompany: false })).map(
        roleFromApi,
      ),
  });
  return {
    roles: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useRoleMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["roles"] });
    void queryClient.invalidateQueries({ queryKey: ["users"] });
    // An admin may just have changed their own rights.
    void queryClient.invalidateQueries({ queryKey: ["session", "me"] });
  };

  const create = useMutation({
    mutationFn: (payload: {
      name: string;
      description: string;
      scope: DataScope;
      permissions: PermissionId[];
    }) =>
      apiFetch<{ id: string }>("/roles", {
        method: "POST",
        withCompany: false,
        body: {
          key: roleKeyFrom(payload.name),
          name: payload.name,
          ...(payload.description ? { description: payload.description } : {}),
          grants: toGrants(payload.permissions, payload.scope, []),
        },
      }),
    onSettled: invalidate,
  });
  const savePermissions = useMutation({
    mutationFn: ({
      role,
      permissions,
    }: {
      role: RoleView;
      permissions: PermissionId[];
    }) =>
      apiFetch(`/roles/${role.id}`, {
        method: "PATCH",
        withCompany: false,
        body: { grants: toGrants(permissions, role.defaultScope, role.grants) },
      }),
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/roles/${id}`, { method: "DELETE", withCompany: false }),
    onSettled: invalidate,
  });

  return { create, savePermissions, remove };
}

// ---------------------------------------------------------------- users

type ApiUser = {
  id: string;
  email: string;
  full_name: string;
  status: UserStatus;
  last_login_at: string | null;
  memberships: Array<{
    company_id: string | null;
    role: { id: string; key: string; name: string };
  }>;
};

export type UserMembership = Membership & { roleKey: string; roleName: string };
export type UserView = Omit<User, "memberships"> & {
  memberships: UserMembership[];
};

function userFromApi(user: ApiUser): UserView {
  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    initials:
      user.full_name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "?",
    status: user.status,
    lastActivityLabel: user.last_login_at
      ? new Date(user.last_login_at).toLocaleDateString()
      : "—",
    memberships: user.memberships.map((membership) => ({
      id: `${user.id}-${membership.company_id ?? ALL_COMPANIES}`,
      userId: user.id,
      companyId: membership.company_id ?? ALL_COMPANIES,
      roleId: membership.role.id,
      roleKey: membership.role.key,
      roleName: membership.role.name,
    })),
  };
}

export function membershipsBody(
  memberships: ReadonlyArray<Pick<Membership, "companyId" | "roleId">>,
) {
  return memberships.map((membership) => ({
    company_id:
      membership.companyId === ALL_COMPANIES ? null : membership.companyId,
    role_id: membership.roleId,
  }));
}

export function useUsers() {
  const check = useCan();
  const { companyId } = useSession();
  // Tenant-wide managers see everyone; the page has its own company filter.
  const tenantWide = check("user.read", "TENANT");
  const query = useQuery({
    queryKey: ["users", tenantWide ? "tenant" : companyId],
    enabled: check("user.read"),
    queryFn: async () =>
      (await apiFetch<ApiUser[]>("/users", { withCompany: !tenantWide })).map(
        userFromApi,
      ),
  });
  return {
    users: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["users"] });
    void queryClient.invalidateQueries({ queryKey: ["roles"] });
    void queryClient.invalidateQueries({ queryKey: ["session", "me"] });
  };

  const create = useMutation({
    mutationFn: (payload: {
      name: string;
      email: string;
      password: string;
      memberships: Array<Pick<Membership, "companyId" | "roleId">>;
    }) =>
      apiFetch("/users", {
        method: "POST",
        withCompany: false,
        body: {
          email: payload.email,
          full_name: payload.name,
          password: payload.password,
          memberships: membershipsBody(payload.memberships),
        },
      }),
    onSettled: invalidate,
  });

  const save = useMutation({
    mutationFn: async ({
      user,
      next,
    }: {
      user: UserView;
      next: { name: string; status: UserStatus; memberships: Membership[] };
    }) => {
      if (next.name !== user.name) {
        await apiFetch(`/users/${user.id}`, {
          method: "PATCH",
          withCompany: false,
          body: { full_name: next.name },
        });
      }
      const before = JSON.stringify(membershipsBody(user.memberships));
      const after = JSON.stringify(membershipsBody(next.memberships));
      if (before !== after) {
        await apiFetch(`/users/${user.id}/memberships`, {
          method: "PUT",
          withCompany: false,
          body: { memberships: membershipsBody(next.memberships) },
        });
      }
      if (next.status !== user.status) {
        await apiFetch(`/users/${user.id}/status`, {
          method: "PATCH",
          withCompany: false,
          body: { status: next.status },
        });
      }
    },
    onSettled: invalidate,
  });

  const disable = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/users/${id}/status`, {
        method: "PATCH",
        withCompany: false,
        body: { status: "DISABLED" },
      }),
    onSettled: invalidate,
  });

  return { create, save, disable };
}
