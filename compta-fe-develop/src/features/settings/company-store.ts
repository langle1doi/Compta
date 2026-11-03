"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_COMPANY_ID, getActiveCompanies } from "./mocks/companies";

let currentCompanyId = DEFAULT_COMPANY_ID;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrentCompanyId() {
  return currentCompanyId;
}

export function setCurrentCompanyId(id: string) {
  if (id === currentCompanyId) return;
  const known = getActiveCompanies().some((company) => company.id === id);
  if (!known) return;
  currentCompanyId = id;
  emit();
}

export function useCurrentCompany() {
  const companyId = useSyncExternalStore(subscribe, getCurrentCompanyId, getCurrentCompanyId);
  const company =
    getActiveCompanies().find((item) => item.id === companyId) ?? getActiveCompanies()[0];
  return { companyId, company, setCompanyId: setCurrentCompanyId };
}
