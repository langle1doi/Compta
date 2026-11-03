"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { apiFetch, setRequestCompanyId } from "@/lib/api/client";

import { grantsToScopes, type BackendGrant } from "./permission-map";
import type { DataScope, PermissionId } from "./types";

export type SessionMembership = {
  company: { id: string; legal_name: string; status: string } | null;
  role: { id: string; key: string; name: string };
  permissions?: BackendGrant[];
};

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  locale: string;
  status: string;
  memberships: SessionMembership[];
};

export type ApiCompany = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  country_code: string;
  siret: string | null;
  vat_number: string | null;
  naf_code: string | null;
  iban: string | null;
  bic: string | null;
  logo_url: string | null;
  currency: string;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type SessionValue = {
  /** "loading" until the user, companies and active company are all known. */
  status: "loading" | "ready" | "error";
  user: SessionUser | null;
  companies: ApiCompany[];
  company: ApiCompany | null;
  companyId: string | null;
  setCompanyId: (id: string) => void;
  /** Role name of the membership that applies to the selected company. */
  roleLabel: string;
  permissions: readonly PermissionId[];
  scopes: ReadonlyMap<PermissionId, DataScope>;
};

const EMPTY_SCOPES: ReadonlyMap<PermissionId, DataScope> = new Map();

const LOADING_SESSION: SessionValue = {
  status: "loading",
  user: null,
  companies: [],
  company: null,
  companyId: null,
  setCompanyId: () => undefined,
  roleLabel: "",
  permissions: [],
  scopes: EMPTY_SCOPES,
};

const SessionContext = createContext<SessionValue>(LOADING_SESSION);

const COMPANY_STORAGE_KEY = "compte.active-company";
const companyListeners = new Set<() => void>();

function subscribeCompany(listener: () => void) {
  companyListeners.add(listener);
  return () => {
    companyListeners.delete(listener);
  };
}

function readStoredCompany() {
  try {
    return window.localStorage.getItem(COMPANY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeCompany(id: string) {
  try {
    window.localStorage.setItem(COMPANY_STORAGE_KEY, id);
  } catch {
    // preference only: the switcher falls back to the first company
  }
  companyListeners.forEach((listener) => listener());
}

/** Single source of the signed-in user, selected company and effective permissions. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const me = useQuery({
    queryKey: ["session", "me"],
    queryFn: () => apiFetch<SessionUser>("/auth/me", { withCompany: false }),
  });
  const companiesQuery = useQuery({
    queryKey: ["session", "companies"],
    queryFn: () => apiFetch<ApiCompany[]>("/companies", { withCompany: false }),
  });
  const storedCompanyId = useSyncExternalStore(
    subscribeCompany,
    readStoredCompany,
    () => null,
  );
  const setCompanyId = useCallback((id: string) => storeCompany(id), []);

  const value = useMemo<SessionValue>(() => {
    if (me.isError || companiesQuery.isError)
      return { ...LOADING_SESSION, status: "error" };
    if (!me.data || !companiesQuery.data) return LOADING_SESSION;

    const companies = companiesQuery.data;
    // X-Company-Id is refused for an inactive company.
    const selectable = companies.filter(
      (company) => company.status === "ACTIVE",
    );
    const company =
      selectable.find((entry) => entry.id === storedCompanyId) ??
      selectable[0] ??
      null;

    // Effective rights: the selected company's membership plus any tenant-wide one, widest scope.
    const applicable = me.data.memberships.filter(
      (membership) =>
        membership.company === null || membership.company.id === company?.id,
    );
    const scopes = grantsToScopes(
      applicable.flatMap((entry) => entry.permissions ?? []),
    );
    const specific = applicable.find((entry) => entry.company !== null);

    return {
      status: "ready",
      user: me.data,
      companies,
      company,
      companyId: company?.id ?? null,
      setCompanyId,
      roleLabel: (specific ?? applicable[0])?.role.name ?? "",
      permissions: [...scopes.keys()],
      scopes,
    };
  }, [
    companiesQuery.data,
    companiesQuery.isError,
    me.data,
    me.isError,
    setCompanyId,
    storedCompanyId,
  ]);

  // Assigned while rendering so that queries started by children already send the right company.
  setRequestCompanyId(value.companyId);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

/** Permissions of the signed-in user for the selected company; empty while loading. */
export function usePermissions() {
  return useSession().permissions;
}
