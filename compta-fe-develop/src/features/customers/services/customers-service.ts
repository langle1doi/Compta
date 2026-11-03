"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useCan } from "@/features/settings/can";
import { useSession } from "@/features/settings/session-provider";
import { apiFetch } from "@/lib/api/client";

import type { CustomerDraft } from "../customer-draft";
import {
  deriveCustomerKpis,
  filterCustomers,
  findDuplicateCandidates,
} from "../query";
import type {
  CsvImportRow,
  CustomerFilters,
  CustomerOwner,
  CustomerRecord,
} from "../types";
import {
  customerFromApi,
  draftToCreateBody,
  planCustomerEdit,
  toOwner,
  type ApiCustomer,
  type ApiCustomerStatus,
} from "./customers-adapter";

const PAGE_SIZE = 100;

type CustomerPage = {
  items: ApiCustomer[];
  total: number;
  page: number;
  page_size: number;
};

/** The API lists one status at a time, 100 per page; filters and KPIs here need the whole set. */
async function fetchAllWithStatus(status: ApiCustomerStatus) {
  const items: ApiCustomer[] = [];
  for (let page = 1; ; page += 1) {
    const result = await apiFetch<CustomerPage>("/customers", {
      query: { status, page, page_size: PAGE_SIZE },
    });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) return items;
  }
}

export function useCustomers() {
  const { companyId } = useSession();
  const query = useQuery({
    queryKey: ["customers", companyId, "list"],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const [active, archived] = await Promise.all([
        fetchAllWithStatus("ACTIVE"),
        fetchAllWithStatus("ARCHIVED"),
      ]);
      return [...active, ...archived].map(customerFromApi);
    },
  });
  return {
    customers: query.data ?? [],
    isLoading: query.isLoading || !companyId,
    error: query.error,
  };
}

export function useCustomerDetail(id: string | null) {
  const { companyId } = useSession();
  return useQuery({
    queryKey: ["customers", companyId, "detail", id],
    enabled: Boolean(companyId && id),
    queryFn: async () =>
      customerFromApi(await apiFetch<ApiCustomer>(`/customers/${id}`)),
  });
}

/**
 * /users needs user.manage, so other roles can only pick themselves and owners already visible.
 * The backend remains the judge of whether an assignment is allowed.
 */
export function useCustomerOwners(customers: CustomerRecord[]) {
  const { companyId, user } = useSession();
  const check = useCan();
  const members = useQuery({
    queryKey: ["users", companyId, "assignable"],
    enabled: Boolean(companyId) && check("user.read"),
    queryFn: () => apiFetch<Array<{ id: string; full_name: string }>>("/users"),
  });

  return useMemo(() => {
    const owners = new Map<string, CustomerOwner>();
    if (user) owners.set(user.id, toOwner(user));
    for (const member of members.data ?? [])
      owners.set(member.id, toOwner(member));
    for (const customer of customers) {
      if (customer.ownerName && !owners.has(customer.ownerId)) {
        owners.set(
          customer.ownerId,
          toOwner({ id: customer.ownerId, full_name: customer.ownerName }),
        );
      }
    }
    return [...owners.values()];
  }, [customers, members.data, user]);
}

export function useCustomerMutations() {
  const { companyId } = useSession();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["customers", companyId] });

  const create = useMutation({
    mutationFn: async (draft: CustomerDraft) =>
      customerFromApi(
        await apiFetch<ApiCustomer>("/customers", {
          method: "POST",
          body: draftToCreateBody(draft),
        }),
      ),
    onSettled: invalidate,
  });

  const saveEdit = useMutation({
    mutationFn: async ({
      customer,
      baseline,
      draft,
    }: {
      customer: CustomerRecord;
      baseline: CustomerDraft;
      draft: CustomerDraft;
    }) => {
      const plan = planCustomerEdit(baseline, draft);
      const base = `/customers/${customer.id}`;
      if (Object.keys(plan.customer).length) {
        await apiFetch(base, { method: "PATCH", body: plan.customer });
      }

      const billing = customer.addresses.find(
        (address) => address.type === "billing",
      );
      if (billing && Object.keys(plan.billing).length) {
        await apiFetch(`${base}/addresses/${billing.id}`, {
          method: "PATCH",
          body: plan.billing,
        });
      }

      const shipping = customer.addresses.find(
        (address) => address.type === "delivery",
      );
      if (plan.shipping.kind === "delete" && shipping) {
        await apiFetch(`${base}/addresses/${shipping.id}`, {
          method: "DELETE",
        });
      }
      if (plan.shipping.kind === "save") {
        await apiFetch(
          shipping ? `${base}/addresses/${shipping.id}` : `${base}/addresses`,
          shipping
            ? { method: "PATCH", body: plan.shipping.body }
            : {
                method: "POST",
                body: { type: "SHIPPING", ...plan.shipping.body },
              },
        );
      }

      for (const id of plan.contacts.remove) {
        await apiFetch(`${base}/contacts/${id}`, { method: "DELETE" });
      }
      for (const { id, body } of plan.contacts.update) {
        await apiFetch(`${base}/contacts/${id}`, { method: "PATCH", body });
      }
      for (const body of plan.contacts.create) {
        await apiFetch(`${base}/contacts`, { method: "POST", body });
      }
    },
    // Also after a partial failure: what did save must show up.
    onSettled: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiCustomerStatus }) =>
      apiFetch(`/customers/${id}/status`, {
        method: "PATCH",
        body: { status },
      }),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/customers/${id}`, { method: "DELETE" }),
    onSettled: invalidate,
  });

  const share = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      apiFetch(`/customers/${id}/shares`, {
        method: "POST",
        body: { user_id: userId },
      }),
    onSettled: invalidate,
  });

  const unshare = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      apiFetch(`/customers/${id}/shares/${userId}`, { method: "DELETE" }),
    onSettled: invalidate,
  });

  return { create, saveEdit, setStatus, remove, share, unshare };
}

export function listCustomersFrom(
  customers: CustomerRecord[],
  filters: CustomerFilters,
) {
  return filterCustomers(customers, filters);
}

export function getCustomerKpisFrom(
  customers: CustomerRecord[],
  filters: CustomerFilters,
) {
  return deriveCustomerKpis(filterCustomers(customers, filters));
}

export function detectDuplicatesIn(
  customers: CustomerRecord[],
  draft: Parameters<typeof findDuplicateCandidates>[1],
  excludeId?: string,
) {
  return findDuplicateCandidates(customers, draft, excludeId);
}

export function previewCsvImport(): CsvImportRow[] {
  return [
    {
      id: "csv-1",
      name: "Horizon Digital",
      email: "hello@horizon-digital.fr",
      type: "company",
      status: "valid",
    },
    {
      id: "csv-2",
      name: "TechVision SARL",
      email: "contact@techvision.fr",
      type: "company",
      status: "duplicate",
      message: "Matches existing SIRET / email",
    },
    {
      id: "csv-3",
      name: "Missing Email Co",
      email: "",
      type: "company",
      status: "error",
      message: "Email is required",
    },
    {
      id: "csv-4",
      name: "Soft Labels",
      email: "team@softlabels.io",
      type: "company",
      status: "valid",
      message: "VAT format looks unusual",
    },
  ];
}
