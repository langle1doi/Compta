export type CustomerType = "company" | "individual";
export type CustomerStatus = "active" | "inactive";
export type AddressType = "billing" | "delivery" | "other";
export type PaymentMethod =
  | "transfer"
  | "check"
  | "card"
  | "direct_debit"
  | "cash"
  | "other"
  | "unset";
export type PaymentTerms = "net_15" | "net_30" | "net_45" | "net_60" | "upon_receipt";
/** The backend stores a free number of days, or nothing. */
export type CustomerPaymentTerms = PaymentTerms | "custom" | "unset";

export type CustomerContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  primary: boolean;
  title?: string;
};

export type CustomerAddress = {
  id: string;
  type: AddressType;
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
  countryCode: string;
  primary: boolean;
};

export type CustomerNote = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
};

export type CustomerActivityKind =
  | "customer_created"
  | "customer_updated"
  | "customer_status_changed"
  | "contact_added"
  | "address_added"
  | "quote_created"
  | "quote_sent"
  | "quote_accepted"
  | "quote_rejected"
  | "quote_expired"
  | "invoice_created"
  | "invoice_validated"
  | "payment_received"
  | "payment_recorded"
  | "email_sent"
  | "note_added";

export type CustomerActivityFilter =
  | "all"
  | "customer"
  | "quotes"
  | "invoices"
  | "payments"
  | "email"
  | "system";

export type CustomerActivity = {
  id: string;
  kind: CustomerActivityKind;
  at: string;
  /** Short event title shown in the timeline. Falls back to summary. */
  title?: string;
  summary: string;
  description?: string;
  actorName?: string;
  relatedLabel?: string;
  amountCents?: number;
};

export type CustomerQuoteStatus =
  | "draft"
  | "sent"
  | "review"
  | "accepted"
  | "rejected"
  | "expired"
  | "invoiced";

export type CustomerQuoteSummary = {
  id: string;
  number: string;
  date: string;
  validUntil?: string;
  amountCents: number;
  status: CustomerQuoteStatus;
};

export type CustomerInvoiceStatus =
  | "draft"
  | "validated"
  | "unpaid"
  | "sent"
  | "paid"
  | "overdue"
  | "partial";

export type CustomerInvoiceSummary = {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  amountCents: number;
  status: CustomerInvoiceStatus;
  quoteId?: string;
  quoteNumber?: string;
};

export type CustomerPaymentStatus = "completed" | "pending" | "failed";

export type CustomerPaymentSummary = {
  id: string;
  reference?: string;
  date: string;
  amountCents: number;
  method: PaymentMethod;
  invoiceNumber: string;
  invoiceId?: string;
  status?: CustomerPaymentStatus;
};

export type CustomerOwner = {
  id: string;
  name: string;
  initials: string;
};

export type CustomerRecord = {
  id: string;
  type: CustomerType;
  status: CustomerStatus;
  displayName: string;
  legalName?: string;
  tradingName?: string;
  siret?: string;
  vatNumber?: string;
  email: string;
  phone?: string;
  website?: string;
  ownerId: string;
  ownerName?: string;
  code?: string;
  paymentTerms: CustomerPaymentTerms;
  paymentTermsDays?: number | null;
  paymentMethod: PaymentMethod;
  defaultQuoteTemplate: string;
  tags: string[];
  contacts: CustomerContact[];
  addresses: CustomerAddress[];
  notes: CustomerNote[];
  activity: CustomerActivity[];
  quotes: CustomerQuoteSummary[];
  invoices: CustomerInvoiceSummary[];
  payments: CustomerPaymentSummary[];
  sharedWithOwnerIds: string[];
  sharedWith?: CustomerOwner[];
  possibleDuplicate?: boolean;
  duplicateOfId?: string;
  revenueCents: number;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerFilters = {
  search: string;
  type: CustomerType | "all";
  ownerId: string | "all";
  tag: string | "all";
  country: string | "all";
  status: CustomerStatus | "all";
};

export type CustomerKpis = {
  totalCustomers: number;
  activeCustomers: number;
  totalRevenueCents: number;
  openQuotes: number;
  openQuotesAmountCents: number;
  overdueInvoices: number;
  overdueAmountCents: number;
  totalDeltaPct: number;
  activeDeltaPct: number;
  revenueDeltaPct: number;
};

export type SiretLookupState = "idle" | "loading" | "found" | "not_found" | "error";

export type SiretLookupResult = {
  legalName: string;
  vatNumber: string;
  address: Omit<CustomerAddress, "id" | "type" | "primary">;
};

export type CsvImportRowStatus = "valid" | "warning" | "duplicate" | "error";

export type CsvImportRow = {
  id: string;
  name: string;
  email: string;
  type: CustomerType;
  status: CsvImportRowStatus;
  message?: string;
};

export const emptyCustomerFilters: CustomerFilters = {
  search: "",
  type: "all",
  ownerId: "all",
  tag: "all",
  country: "all",
  status: "all",
};
