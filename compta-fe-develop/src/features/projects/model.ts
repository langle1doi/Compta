export type ProjectStatus =
  | "draft"
  | "active"
  | "completed"
  | "on_hold"
  | "archived";

/** UX/domain assumption — PRD requires approval but not an exact lifecycle. */
export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "approved"
  | "rejected";

export type ExpenseCategory =
  | "travel"
  | "materials"
  | "subcontracting"
  | "other";

export type ProjectActivityType =
  | "created"
  | "status_changed"
  | "quote_linked"
  | "invoice_linked"
  | "expense_submitted"
  | "expense_approved"
  | "expense_rejected";

export type Project = {
  id: string;
  code: string;
  name: string;
  customerId: string;
  customerName: string;
  companyId: string;
  description: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  quoteIds: string[];
  invoiceIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectExpense = {
  id: string;
  projectId: string | null;
  companyId: string;
  submittedBy: string;
  date: string;
  supplier: string;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  vatCents: number;
  currency: string;
  receiptName: string | null;
  ocrApplied: boolean;
  status: ExpenseStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectActivity = {
  id: string;
  projectId: string;
  at: string;
  type: ProjectActivityType;
  titleKey: string;
  bodyKey?: string;
  bodyParams?: Record<string, number | string>;
  actor: string;
};

export type ProjectFinance = {
  quoteCount: number;
  invoiceCount: number;
  quotedCents: number;
  revenueCents: number;
  collectedCents: number;
  outstandingCents: number;
  costCents: number;
  profitCents: number;
  marginRatio: number | null;
};

export type ProjectsKpis = {
  totalProjects: number;
  activeProjects: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginRatio: number | null;
};
