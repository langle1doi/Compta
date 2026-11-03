import type {
  CustomerActivity,
  CustomerActivityFilter,
  CustomerActivityKind,
  CustomerInvoiceStatus,
  CustomerQuoteStatus,
  CustomerRecord,
} from "./types";

const ACTIVITY_FILTER_KINDS: Record<
  Exclude<CustomerActivityFilter, "all">,
  CustomerActivityKind[]
> = {
  customer: [
    "customer_created",
    "customer_updated",
    "customer_status_changed",
    "contact_added",
    "address_added",
    "note_added",
  ],
  quotes: [
    "quote_created",
    "quote_sent",
    "quote_accepted",
    "quote_rejected",
    "quote_expired",
  ],
  invoices: ["invoice_created", "invoice_validated"],
  payments: ["payment_received", "payment_recorded"],
  email: ["email_sent"],
  system: ["customer_created", "customer_status_changed"],
};

export function activityTitle(item: CustomerActivity) {
  return item.title?.trim() || item.summary;
}

export function activityDescription(item: CustomerActivity) {
  return item.description?.trim() || undefined;
}

export function filterCustomerActivity(
  items: CustomerActivity[],
  filter: CustomerActivityFilter,
) {
  const sorted = [...items].sort(
    (left, right) => new Date(right.at).getTime() - new Date(left.at).getTime(),
  );
  if (filter === "all") return sorted;
  const kinds = ACTIVITY_FILTER_KINDS[filter];
  return sorted.filter((item) => kinds.includes(item.kind));
}

export function activityFiltersFor(items: CustomerActivity[]): CustomerActivityFilter[] {
  const available: CustomerActivityFilter[] = ["all"];
  (Object.keys(ACTIVITY_FILTER_KINDS) as Exclude<CustomerActivityFilter, "all">[]).forEach(
    (key) => {
      if (items.some((item) => ACTIVITY_FILTER_KINDS[key].includes(item.kind))) {
        available.push(key);
      }
    },
  );
  return available;
}

export function hasAcceptedQuoteReady(customer: CustomerRecord) {
  return customer.quotes.some((quote) => quote.status === "accepted");
}

export function hasEligibleInvoiceForPayment(customer: CustomerRecord) {
  return customer.invoices.some((invoice) =>
    ["validated", "unpaid", "sent", "partial", "overdue"].includes(invoice.status),
  );
}

export function isInvoiceLocked(status: CustomerInvoiceStatus) {
  return status !== "draft";
}

export function quoteStatusTone(
  status: CustomerQuoteStatus,
): "slate" | "blue" | "green" | "red" | "orange" | "purple" {
  switch (status) {
    case "draft":
      return "slate";
    case "sent":
    case "review":
      return "blue";
    case "accepted":
      return "green";
    case "rejected":
      return "red";
    case "expired":
      return "slate";
    case "invoiced":
      return "purple";
    default:
      return "slate";
  }
}

export function invoiceStatusTone(
  status: CustomerInvoiceStatus,
): "slate" | "blue" | "green" | "red" | "orange" | "purple" {
  switch (status) {
    case "draft":
      return "slate";
    case "validated":
    case "unpaid":
    case "sent":
      return "blue";
    case "partial":
      return "orange";
    case "paid":
      return "green";
    case "overdue":
      return "red";
    default:
      return "slate";
  }
}

export function paymentStatusTone(
  status: NonNullable<CustomerRecord["payments"][number]["status"]>,
): "slate" | "blue" | "green" | "red" | "orange" {
  switch (status) {
    case "completed":
      return "green";
    case "pending":
      return "orange";
    case "failed":
      return "red";
    default:
      return "slate";
  }
}

export function activityTone(
  kind: CustomerActivityKind,
): "blue" | "purple" | "green" | "orange" | "slate" {
  if (kind.startsWith("quote_")) return "purple";
  if (kind.startsWith("invoice_")) return "blue";
  if (kind.startsWith("payment_")) return "green";
  if (kind === "email_sent") return "orange";
  if (kind === "customer_status_changed") return "orange";
  return "blue";
}

/** Append a temporary in-memory activity (lost on reload). */
export function prependActivity(
  customer: CustomerRecord,
  activity: Omit<CustomerActivity, "id" | "at"> & { id?: string; at?: string },
): CustomerRecord {
  const at = activity.at ?? new Date().toISOString();
  const next: CustomerActivity = {
    id: activity.id ?? `ac-temp-${Date.now()}`,
    kind: activity.kind,
    at,
    title: activity.title,
    summary: activity.summary,
    description: activity.description,
    actorName: activity.actorName,
    relatedLabel: activity.relatedLabel,
    amountCents: activity.amountCents,
  };
  return {
    ...customer,
    activity: [next, ...customer.activity],
    lastActivityAt: at,
    updatedAt: at,
  };
}

export function createInvoiceFromAcceptedQuote(
  customer: CustomerRecord,
  actorName = "System",
): CustomerRecord | null {
  const quote = customer.quotes.find((item) => item.status === "accepted");
  if (!quote) return null;
  const stamp = Date.now().toString().slice(-3);
  const number = `FAC-2026-${stamp}`;
  const at = new Date().toISOString();
  const invoice = {
    id: `i-temp-${Date.now()}`,
    number,
    issueDate: at.slice(0, 10),
    dueDate: at.slice(0, 10),
    amountCents: quote.amountCents,
    status: "validated" as const,
    quoteId: quote.id,
    quoteNumber: quote.number,
  };
  return {
    ...customer,
    quotes: customer.quotes.map((item) =>
      item.id === quote.id ? { ...item, status: "invoiced" as const } : item,
    ),
    invoices: [invoice, ...customer.invoices],
    activity: [
      {
        id: `ac-inv-${Date.now()}`,
        kind: "invoice_created",
        at,
        title: `Invoice ${number} created`,
        summary: `Invoice ${number} created`,
        description: `From accepted quote ${quote.number}.`,
        actorName,
        relatedLabel: number,
        amountCents: quote.amountCents,
      },
      {
        id: `ac-invv-${Date.now() + 1}`,
        kind: "invoice_validated",
        at,
        title: `Invoice ${number} validated`,
        summary: `Invoice ${number} validated`,
        description: "Invoice validated and locked.",
        actorName,
        relatedLabel: number,
      },
      ...customer.activity,
    ],
    lastActivityAt: at,
    updatedAt: at,
  };
}

export function recordMockPayment(
  customer: CustomerRecord,
  actorName = "System",
): CustomerRecord | null {
  const invoice = customer.invoices.find((item) =>
    ["validated", "unpaid", "sent", "partial", "overdue"].includes(item.status),
  );
  if (!invoice) return null;
  const at = new Date().toISOString();
  const reference = `PAY-2026-${Date.now().toString().slice(-3)}`;
  const amountCents =
    invoice.status === "partial"
      ? Math.round(invoice.amountCents / 2)
      : invoice.amountCents;
  const payment = {
    id: `p-temp-${Date.now()}`,
    reference,
    date: at.slice(0, 10),
    amountCents,
    method: customer.paymentMethod,
    invoiceNumber: invoice.number,
    invoiceId: invoice.id,
    status: "completed" as const,
  };
  const paidTotal =
    customer.payments
      .filter((item) => item.invoiceNumber === invoice.number)
      .reduce((sum, item) => sum + item.amountCents, 0) + amountCents;
  const nextStatus =
    paidTotal >= invoice.amountCents
      ? ("paid" as const)
      : paidTotal > 0
        ? ("partial" as const)
        : invoice.status;

  return {
    ...customer,
    invoices: customer.invoices.map((item) =>
      item.id === invoice.id ? { ...item, status: nextStatus } : item,
    ),
    payments: [payment, ...customer.payments],
    activity: [
      {
        id: `ac-pay-${Date.now()}`,
        kind: "payment_recorded",
        at,
        title: `Payment of ${(amountCents / 100).toLocaleString("fr-FR")} € recorded`,
        summary: `Payment recorded on ${invoice.number}`,
        description: `${invoice.number} · ${customer.paymentMethod}`,
        actorName,
        relatedLabel: reference,
        amountCents,
      },
      ...customer.activity,
    ],
    lastActivityAt: at,
    updatedAt: at,
  };
}
