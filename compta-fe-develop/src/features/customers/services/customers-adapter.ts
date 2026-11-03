import { ApiError } from "@/lib/api/client";

import { countryLabel } from "../countries";
import { normalizePhone, type CustomerDraft } from "../customer-draft";
import type {
  AddressType,
  CustomerAddress,
  CustomerContact,
  CustomerPaymentTerms,
  CustomerRecord,
  PaymentMethod,
} from "../types";

/** Wire format of /customers: snake_case, enums in capitals. All conversions live in this file. */
export type ApiCustomerType = "COMPANY" | "INDIVIDUAL";
export type ApiCustomerStatus = "ACTIVE" | "ARCHIVED";
type ApiAddressType = "BILLING" | "SHIPPING" | "OTHER";
type ApiPaymentMethod =
  "BANK_TRANSFER" | "CARD" | "CHEQUE" | "CASH" | "DIRECT_DEBIT" | "OTHER";

export type ApiCustomerContact = {
  id: string;
  first_name: string | null;
  last_name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

export type ApiCustomerAddress = {
  id: string;
  type: ApiAddressType;
  label: string | null;
  line1: string;
  line2: string | null;
  postal_code: string;
  city: string;
  country_code: string;
  is_default: boolean;
};

export type ApiCustomer = {
  id: string;
  code: string;
  type: ApiCustomerType;
  status: ApiCustomerStatus;
  name: string;
  siret: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  payment_terms_days: number | null;
  payment_method: ApiPaymentMethod | null;
  tags: string[];
  notes: string | null;
  owner_id: string;
  owner?: { id: string; full_name: string };
  created_at: string;
  updated_at: string;
  contacts?: ApiCustomerContact[];
  addresses?: ApiCustomerAddress[];
  shares?: Array<{ user: { id: string; full_name: string } }>;
};

const METHOD_FROM_API: Record<ApiPaymentMethod, PaymentMethod> = {
  BANK_TRANSFER: "transfer",
  CARD: "card",
  CHEQUE: "check",
  CASH: "cash",
  DIRECT_DEBIT: "direct_debit",
  OTHER: "other",
};

const METHOD_TO_API: Partial<Record<PaymentMethod, ApiPaymentMethod>> = {
  transfer: "BANK_TRANSFER",
  card: "CARD",
  check: "CHEQUE",
  cash: "CASH",
  direct_debit: "DIRECT_DEBIT",
  other: "OTHER",
};

const ADDRESS_FROM_API: Record<ApiAddressType, AddressType> = {
  BILLING: "billing",
  SHIPPING: "delivery",
  OTHER: "other",
};

const TERMS_DAYS: Partial<Record<CustomerPaymentTerms, number>> = {
  upon_receipt: 0,
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
};

function termsFromDays(days: number | null): CustomerPaymentTerms {
  if (days === null) return "unset";
  const known = Object.entries(TERMS_DAYS).find(([, value]) => value === days);
  return known ? (known[0] as CustomerPaymentTerms) : "custom";
}

function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function toOwner(user: { id: string; full_name: string }) {
  return {
    id: user.id,
    name: user.full_name,
    initials: initialsOf(user.full_name),
  };
}

function contactFromApi(contact: ApiCustomerContact): CustomerContact {
  return {
    id: contact.id,
    name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    primary: contact.is_primary,
    title: contact.job_title ?? undefined,
  };
}

function addressFromApi(address: ApiCustomerAddress): CustomerAddress {
  return {
    id: address.id,
    type: ADDRESS_FROM_API[address.type],
    label: address.label ?? undefined,
    line1: address.line1,
    line2: address.line2 ?? undefined,
    city: address.city,
    postalCode: address.postal_code,
    country: countryLabel(address.country_code, address.country_code),
    countryCode: address.country_code,
    primary: address.is_default,
  };
}

/**
 * Quotes, invoices, payments and activity have no backend yet: they stay empty rather than mocked.
 * The list endpoint omits contacts and addresses; they arrive with the detail endpoint.
 */
export function customerFromApi(customer: ApiCustomer): CustomerRecord {
  return {
    id: customer.id,
    code: customer.code,
    type: customer.type === "COMPANY" ? "company" : "individual",
    status: customer.status === "ACTIVE" ? "active" : "inactive",
    displayName: customer.name,
    siret: customer.siret ?? undefined,
    vatNumber: customer.vat_number ?? undefined,
    email: customer.email ?? "",
    phone: customer.phone ?? undefined,
    website: customer.website ?? undefined,
    ownerId: customer.owner_id,
    ownerName: customer.owner?.full_name,
    paymentTerms: termsFromDays(customer.payment_terms_days),
    paymentTermsDays: customer.payment_terms_days,
    paymentMethod: customer.payment_method
      ? METHOD_FROM_API[customer.payment_method]
      : "unset",
    defaultQuoteTemplate: "",
    tags: customer.tags,
    contacts: (customer.contacts ?? []).map(contactFromApi),
    addresses: (customer.addresses ?? []).map(addressFromApi),
    notes: customer.notes
      ? [
          {
            id: `${customer.id}-notes`,
            body: customer.notes,
            createdAt: customer.updated_at,
            authorName: customer.owner?.full_name ?? "",
          },
        ]
      : [],
    activity: [],
    quotes: [],
    invoices: [],
    payments: [],
    sharedWithOwnerIds: (customer.shares ?? []).map((share) => share.user.id),
    sharedWith: (customer.shares ?? []).map((share) => toOwner(share.user)),
    revenueCents: 0,
    lastActivityAt: customer.updated_at,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  };
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const last_name = parts.pop() ?? "";
  return { first_name: parts.join(" ") || null, last_name };
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function identityBody(draft: CustomerDraft) {
  const isCompany = draft.type === "company";
  return {
    type: (isCompany ? "COMPANY" : "INDIVIDUAL") as ApiCustomerType,
    name: draft.displayName.trim(),
    ...(isCompany ? {} : splitName(draft.displayName)),
    siret: isCompany ? optional(draft.siret.replace(/\s/g, "")) : null,
    vat_number: isCompany ? optional(draft.vatNumber) : null,
    email: optional(draft.email),
    phone: optional(normalizePhone(draft.phone)),
    website: optional(draft.website),
    payment_terms_days: TERMS_DAYS[draft.paymentTerms] ?? null,
    payment_method: METHOD_TO_API[draft.paymentMethod] ?? null,
    tags: draft.tags,
  };
}

function billingBody(draft: CustomerDraft) {
  return {
    line1: draft.billingLine1.trim(),
    line2: optional(draft.billingLine2),
    postal_code: draft.billingPostalCode.trim(),
    city: draft.billingCity.trim(),
    country_code: draft.billingCountryCode,
  };
}

function shippingBody(draft: CustomerDraft) {
  return {
    line1: draft.deliveryLine1.trim(),
    line2: optional(draft.deliveryLine2),
    postal_code: draft.deliveryPostalCode.trim(),
    city: draft.deliveryCity.trim(),
    country_code: draft.deliveryCountryCode,
  };
}

function contactBody(
  contact: CustomerDraft["contacts"][number],
  fallbackName: string,
) {
  return {
    ...splitName(contact.name.trim() || fallbackName),
    email: optional(contact.email),
    phone: optional(normalizePhone(contact.phone)),
    is_primary: contact.primary,
  };
}

function dropEmpty<T extends Record<string, unknown>>(body: T) {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== null),
  );
}

/** The customer code is assigned by the backend and at least one BILLING address is mandatory. */
export function draftToCreateBody(draft: CustomerDraft) {
  const hasContact = [
    draft.contactName,
    draft.contactEmail,
    draft.contactPhone,
  ].some((value) => value.trim());
  const addresses: Array<Record<string, unknown>> = [
    { type: "BILLING", is_default: true, ...dropEmpty(billingBody(draft)) },
  ];
  if (!draft.useBillingForDelivery && draft.deliveryLine1.trim()) {
    addresses.push({
      type: "SHIPPING",
      is_default: true,
      ...dropEmpty(shippingBody(draft)),
    });
  }
  return {
    ...dropEmpty(identityBody(draft)),
    owner_id: draft.ownerId || undefined,
    addresses,
    ...(hasContact
      ? {
          contacts: [
            dropEmpty(
              contactBody(
                {
                  id: "",
                  name: draft.contactName,
                  email: draft.contactEmail,
                  phone: draft.contactPhone,
                  primary: true,
                },
                draft.displayName,
              ),
            ),
          ],
        }
      : {}),
  };
}

/** Only what changed, so a value the form cannot represent (e.g. 7-day terms) is left alone. */
function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(after).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key]),
    ),
  ) as Partial<T>;
}

export type CustomerEditPlan = {
  customer: Record<string, unknown>;
  billing: Record<string, unknown>;
  shipping:
    | { kind: "none" }
    | { kind: "delete" }
    | { kind: "save"; body: Record<string, unknown> };
  contacts: {
    create: Array<Record<string, unknown>>;
    update: Array<{ id: string; body: Record<string, unknown> }>;
    remove: string[];
  };
};

export function planCustomerEdit(
  baseline: CustomerDraft,
  draft: CustomerDraft,
): CustomerEditPlan {
  const customer: Record<string, unknown> = changedFields(
    identityBody(baseline),
    identityBody(draft),
  );
  if (draft.ownerId !== baseline.ownerId) customer.owner_id = draft.ownerId;

  const before = new Map(
    baseline.contacts.map((contact) => [contact.id, contact]),
  );
  const usable = draft.contacts.filter(
    (contact) =>
      before.has(contact.id) || contact.name.trim() || contact.email.trim(),
  );
  const shippingChanged =
    JSON.stringify(shippingBody(baseline)) !==
    JSON.stringify(shippingBody(draft));

  let shipping: CustomerEditPlan["shipping"] = { kind: "none" };
  if (draft.useBillingForDelivery && !baseline.useBillingForDelivery)
    shipping = { kind: "delete" };
  else if (
    !draft.useBillingForDelivery &&
    (baseline.useBillingForDelivery || shippingChanged)
  ) {
    shipping = { kind: "save", body: shippingBody(draft) };
  }

  return {
    customer,
    billing: changedFields(billingBody(baseline), billingBody(draft)),
    shipping,
    contacts: {
      create: usable
        .filter((contact) => !before.has(contact.id))
        .map((contact) => dropEmpty(contactBody(contact, draft.displayName))),
      update: usable.flatMap((contact) => {
        const previous = before.get(contact.id);
        if (!previous) return [];
        const body = changedFields(
          contactBody(previous, baseline.displayName),
          contactBody(contact, draft.displayName),
        );
        return Object.keys(body).length ? [{ id: contact.id, body }] : [];
      }),
      remove: baseline.contacts
        .filter(
          (contact) => !draft.contacts.some((item) => item.id === contact.id),
        )
        .map((contact) => contact.id),
    },
  };
}

const FIELD_TO_DRAFT: Record<string, keyof CustomerDraft> = {
  name: "displayName",
  last_name: "displayName",
  email: "email",
  phone: "phone",
  website: "website",
  siret: "siret",
  vat_number: "vatNumber",
  owner_id: "ownerId",
  addresses: "billingLine1",
  "addresses.0.line1": "billingLine1",
  "addresses.0.postal_code": "billingPostalCode",
  "addresses.0.city": "billingCity",
  "addresses.1.line1": "deliveryLine1",
  "addresses.1.postal_code": "deliveryPostalCode",
  "addresses.1.city": "deliveryCity",
  line1: "billingLine1",
  postal_code: "billingPostalCode",
  city: "billingCity",
  "contacts.0.email": "contactEmail",
  "contacts.0.phone": "contactPhone",
  "contacts.0.last_name": "contactName",
};

export type CustomerFieldErrors = Partial<Record<keyof CustomerDraft, string>>;

/** Maps a backend 422 onto form fields; the first error of each field wins. */
export function customerFieldErrors(
  error: unknown,
  translate: (field: { code: string; message: string }) => string,
): CustomerFieldErrors {
  if (!(error instanceof ApiError)) return {};
  const result: CustomerFieldErrors = {};
  for (const field of error.fields) {
    const key = FIELD_TO_DRAFT[field.field];
    if (key && !result[key]) result[key] = translate(field);
  }
  return result;
}
