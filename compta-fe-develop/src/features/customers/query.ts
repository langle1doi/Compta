import type {
  CustomerFilters,
  CustomerKpis,
  CustomerRecord,
} from "./types";

function primaryBilling(customer: CustomerRecord) {
  return (
    customer.addresses.find((address) => address.type === "billing" && address.primary) ??
    customer.addresses.find((address) => address.type === "billing") ??
    customer.addresses[0]
  );
}

export function customerCountry(customer: CustomerRecord) {
  return primaryBilling(customer)?.country ?? "—";
}

export function customerCountryCode(customer: CustomerRecord) {
  return primaryBilling(customer)?.countryCode ?? "";
}

export function customerInitials(customer: CustomerRecord) {
  const parts = customer.displayName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function getPrimaryContact(customer: CustomerRecord) {
  return customer.contacts.find((contact) => contact.primary) ?? customer.contacts[0];
}

export function getPrimaryEmail(customer: CustomerRecord) {
  return getPrimaryContact(customer)?.email ?? customer.email;
}

export function matchesCustomerFilters(
  customer: CustomerRecord,
  filters: CustomerFilters,
): boolean {
  if (filters.type !== "all" && customer.type !== filters.type) return false;
  if (filters.ownerId !== "all" && customer.ownerId !== filters.ownerId) return false;
  if (filters.status !== "all" && customer.status !== filters.status) return false;
  if (filters.tag !== "all" && !customer.tags.includes(filters.tag)) return false;
  if (filters.country !== "all" && customerCountryCode(customer) !== filters.country) {
    return false;
  }

  const q = filters.search.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    customer.displayName,
    customer.code,
    customer.email,
    customer.siret,
    customer.vatNumber,
    ...customer.contacts.map((contact) => `${contact.name} ${contact.email}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export function filterCustomers(
  customers: CustomerRecord[],
  filters: CustomerFilters,
): CustomerRecord[] {
  return customers
    .filter((customer) => matchesCustomerFilters(customer, filters))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
}

export function deriveCustomerKpis(customers: CustomerRecord[]): CustomerKpis {
  const active = customers.filter((customer) => customer.status === "active");
  const openQuoteStatuses = new Set(["draft", "sent", "review"]);
  const openQuotes = customers.flatMap((customer) =>
    customer.quotes.filter((quote) => openQuoteStatuses.has(quote.status)),
  );
  const overdue = customers.flatMap((customer) =>
    customer.invoices.filter((invoice) => invoice.status === "overdue"),
  );

  return {
    totalCustomers: customers.length,
    activeCustomers: active.length,
    totalRevenueCents: customers.reduce((sum, customer) => sum + customer.revenueCents, 0),
    openQuotes: openQuotes.length,
    openQuotesAmountCents: openQuotes.reduce((sum, quote) => sum + quote.amountCents, 0),
    overdueInvoices: overdue.length,
    overdueAmountCents: overdue.reduce((sum, invoice) => sum + invoice.amountCents, 0),
    totalDeltaPct: 0,
    activeDeltaPct: 0,
    revenueDeltaPct: 0,
  };
}

export function findDuplicateCandidates(
  customers: CustomerRecord[],
  draft: { displayName: string; email: string; siret?: string; vatNumber?: string },
  excludeId?: string,
): CustomerRecord[] {
  const name = draft.displayName.trim().toLowerCase();
  const email = draft.email.trim().toLowerCase();
  const siret = draft.siret?.replace(/\s/g, "");
  const vat = draft.vatNumber?.replace(/\s/g, "").toUpperCase();

  return customers.filter((customer) => {
    if (excludeId && customer.id === excludeId) return false;
    if (siret && customer.siret?.replace(/\s/g, "") === siret) return true;
    if (vat && customer.vatNumber?.replace(/\s/g, "").toUpperCase() === vat) return true;
    if (email && customer.email.toLowerCase() === email) return true;
    if (name && customer.displayName.toLowerCase() === name) return true;
    return false;
  });
}

export function formatRelativeActivity(
  iso: string,
  now = new Date(),
): { key: "today" | "days" | "weeks" | "months"; count?: number } {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return { key: "today" };
  if (days < 7) return { key: "days", count: days };
  if (days < 30) return { key: "weeks", count: Math.max(1, Math.floor(days / 7)) };
  return { key: "months", count: Math.max(1, Math.floor(days / 30)) };
}

export function uniqueCountries(customers: CustomerRecord[]) {
  const map = new Map<string, string>();
  for (const customer of customers) {
    const code = customerCountryCode(customer);
    const label = customerCountry(customer);
    if (code) map.set(code, label);
  }
  return [...map.entries()]
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

export function uniqueTags(customers: CustomerRecord[]) {
  return [...new Set(customers.flatMap((customer) => customer.tags))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}

export function customerTermsLabel(
  t: (key: string, values?: Record<string, string | number>) => string,
  customer: Pick<CustomerRecord, "paymentTerms" | "paymentTermsDays">,
) {
  return customer.paymentTerms === "custom"
    ? t("terms.custom", { days: customer.paymentTermsDays ?? 0 })
    : t(`terms.${customer.paymentTerms}`);
}
