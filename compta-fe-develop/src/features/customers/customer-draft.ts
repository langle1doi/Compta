import { composePhone, parsePhoneValue } from "./countries";
import type {
  CustomerPaymentTerms,
  CustomerRecord,
  CustomerType,
  PaymentMethod,
} from "./types";

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = parsePhoneValue(trimmed);
  return composePhone(parsed.code, parsed.national);
}

export type CustomerDraft = {
  type: CustomerType;
  displayName: string;
  siret: string;
  vatNumber: string;
  email: string;
  phone: string;
  website: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  billingLine1: string;
  billingLine2: string;
  billingCity: string;
  billingPostalCode: string;
  billingCountry: string;
  billingCountryCode: string;
  deliveryLine1: string;
  deliveryLine2: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  deliveryCountryCode: string;
  useBillingForDelivery: boolean;
  paymentTerms: CustomerPaymentTerms;
  paymentMethod: PaymentMethod;
  ownerId: string;
  tags: string[];
  contacts: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    primary: boolean;
  }>;
};

export function initialCustomerDraft(ownerId: string): CustomerDraft {
  return {
    type: "company",
    displayName: "",
    siret: "",
    vatNumber: "",
    email: "",
    phone: "",
    website: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    billingLine1: "",
    billingLine2: "",
    billingCity: "",
    billingPostalCode: "",
    billingCountry: "France",
    billingCountryCode: "FR",
    deliveryLine1: "",
    deliveryLine2: "",
    deliveryCity: "",
    deliveryPostalCode: "",
    deliveryCountry: "France",
    deliveryCountryCode: "FR",
    useBillingForDelivery: true,
    paymentTerms: "net_30",
    paymentMethod: "transfer",
    ownerId,
    tags: [],
    contacts: [],
  };
}

export function recordToDraft(customer: CustomerRecord): CustomerDraft {
  const contact = customer.contacts.find((item) => item.primary) ?? customer.contacts[0];
  const billing =
    customer.addresses.find((item) => item.type === "billing" && item.primary) ??
    customer.addresses.find((item) => item.type === "billing") ??
    customer.addresses[0];
  const delivery = customer.addresses.find((item) => item.type === "delivery");
  const sameDelivery =
    !delivery ||
    (delivery.line1 === billing?.line1 &&
      delivery.city === billing?.city &&
      delivery.postalCode === billing?.postalCode);

  return {
    type: customer.type,
    displayName: customer.displayName,
    siret: customer.siret ?? "",
    vatNumber: customer.vatNumber ?? "",
    email: customer.email,
    phone: customer.phone ?? "",
    website: customer.website ?? "",
    contactName: contact?.name ?? "",
    contactEmail: contact?.email ?? "",
    contactPhone: contact?.phone ?? "",
    billingLine1: billing?.line1 ?? "",
    billingLine2: billing?.line2 ?? "",
    billingCity: billing?.city ?? "",
    billingPostalCode: billing?.postalCode ?? "",
    billingCountry: billing?.country ?? "France",
    billingCountryCode: billing?.countryCode ?? "FR",
    deliveryLine1: delivery?.line1 ?? "",
    deliveryLine2: delivery?.line2 ?? "",
    deliveryCity: delivery?.city ?? "",
    deliveryPostalCode: delivery?.postalCode ?? "",
    deliveryCountry: delivery?.country ?? "France",
    deliveryCountryCode: delivery?.countryCode ?? "FR",
    useBillingForDelivery: sameDelivery,
    paymentTerms: customer.paymentTerms,
    paymentMethod: customer.paymentMethod,
    ownerId: customer.ownerId,
    tags: [...customer.tags],
    contacts: customer.contacts.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      primary: item.primary,
    })),
  };
}

export type CustomerDraftSaveField =
  | "displayName"
  | "email"
  | "website"
  | "billingLine1"
  | "billingPostalCode"
  | "billingCity";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getCustomerDraftSaveIssues(draft: CustomerDraft): CustomerDraftSaveField[] {
  const issues: CustomerDraftSaveField[] = [];
  if (!draft.displayName.trim()) issues.push("displayName");
  // Optional for the backend, but must be valid when given.
  if (draft.email.trim() && !EMAIL_RE.test(draft.email.trim())) issues.push("email");
  if (draft.website.trim()) {
    try {
      // Accept bare domains by prefixing for validation only.
      const candidate = /^https?:\/\//i.test(draft.website.trim())
        ? draft.website.trim()
        : `https://${draft.website.trim()}`;
      new URL(candidate);
    } catch {
      issues.push("website");
    }
  }
  // The backend requires a complete billing address on every customer.
  if (!draft.billingLine1.trim()) issues.push("billingLine1");
  if (!draft.billingPostalCode.trim()) issues.push("billingPostalCode");
  if (!draft.billingCity.trim()) issues.push("billingCity");
  return issues;
}

export function canSaveCustomerDraft(draft: CustomerDraft) {
  return getCustomerDraftSaveIssues(draft).length === 0;
}

export function draftsEqual(a: CustomerDraft, b: CustomerDraft) {
  return JSON.stringify(a) === JSON.stringify(b);
}
