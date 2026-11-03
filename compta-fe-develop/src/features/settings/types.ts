export type DataScope = "OWN" | "COMPANY" | "TENANT";

export type UserStatus = "ACTIVE" | "INVITED" | "DISABLED";

export type CompanyStatus = "ACTIVE" | "ARCHIVED";

export type PermissionId =
  | "company.read"
  | "company.create"
  | "company.update"
  | "company.archive"
  | "company.manage"
  | "user.read"
  | "user.invite"
  | "user.update"
  | "user.disable"
  | "role.read"
  | "role.manage"
  | "customer.read"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "product.read"
  | "product.create"
  | "product.update"
  | "quote.read"
  | "quote.create"
  | "quote.update"
  | "quote.send"
  | "quote.approve"
  | "invoice.read"
  | "invoice.create"
  | "invoice.validate"
  | "payment.read"
  | "payment.create"
  | "payment.manage"
  | "template.email.read"
  | "template.email.manage"
  | "template.pdf.read"
  | "template.pdf.manage"
  | "report.read"
  | "report.export"
  | "automation.read"
  | "automation.manage"
  | "automation.approve"
  | "project.read"
  | "project.create"
  | "project.update"
  | "project.finance"
  | "expense.read"
  | "expense.create"
  | "expense.approve"
  | "security.session.manage"
  | "audit.read"
  | "bank.read"
  | "bank.manage"
  | "integration.read"
  | "integration.manage"
  | "dashboard.view"
  | "invoice.request"
  | "credit_note.create"
  | "ai.use";

export type Capability =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "send"
  | "approve"
  | "validate"
  | "manage"
  | "invite"
  | "disable"
  | "export";

export type RoleId =
  | "tenant-admin"
  | "business-owner"
  | "accountant"
  | "sales"
  | "viewer";

/** Legal entity belonging to the tenant. */
export type Company = {
  id: string;
  /** Display name used in switcher / lists. */
  name: string;
  legalName: string;
  currency: string;
  status: CompanyStatus;
  siret?: string;
  vatNumber?: string;
  naf?: string;
  iban?: string;
  bic?: string;
  logoUrl?: string;
  address?: string;
  subtitle?: string;
};

/**
 * N:N link between User and Company with a per-company role.
 * Do not collapse this into user.roleId / user.companyId.
 */
export type Membership = {
  id: string;
  userId: string;
  companyId: string;
  roleId: RoleId | string;
};

export type Role = {
  id: RoleId | string;
  nameKey: string;
  descriptionKey: string;
  cardDescriptionKey: string;
  /** Literal display name for custom roles (no i18n key). */
  label?: string;
  /** Literal description for custom roles (no i18n key). */
  description?: string;
  defaultScope: DataScope;
  permissions: PermissionId[];
  system: boolean;
  platform?: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  initials: string;
  status: UserStatus;
  lastActivityLabel: string;
  memberships: Membership[];
};

/** @deprecated Prefer User + Membership. Kept for transitional helpers. */
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  initials: string;
  roleId: RoleId | string;
  dataScope: DataScope;
  companyIds: string[];
  status: UserStatus;
  lastActivityLabel: string;
};

export type PermissionCapability = {
  capability: Capability;
  permission: PermissionId;
  sensitive?: boolean;
};

export type PermissionModule = {
  id: string;
  labelKey: string;
  phase?: 2;
  capabilities: PermissionCapability[];
};

export type PermissionAction = {
  id: string;
  labelKey: string;
  permission: PermissionId;
  sensitive?: boolean;
  noteKey?: string;
  searchTerms: string[];
};

export type PermissionGroup = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  phase?: 2;
  actions: PermissionAction[];
};

export type ApprovalRulesConfig = {
  quoteApprovalThresholdEuro: number;
  requireApprovalAboveThreshold: boolean;
};

export type SsoProviderStatus = "connected" | "not_configured";

export type SecuritySettingsConfig = {
  totpEnabled: boolean;
  email2faEnabled: boolean;
  googleSso: SsoProviderStatus;
  microsoftSso: SsoProviderStatus;
  failedLoginLockout: number;
  preferredLanguage: "fr" | "en" | "vi";
};

export type RoleDetailTab = "matrix" | "settings" | "description";

export type CompanyDraft = {
  name: string;
  legalName: string;
  currency: string;
  siret: string;
  vatNumber: string;
  naf: string;
  iban: string;
  bic: string;
  address: string;
  logoUrl: string;
};

export type SettingsNavItemId =
  | "general"
  | "companies"
  | "users"
  | "roles";
