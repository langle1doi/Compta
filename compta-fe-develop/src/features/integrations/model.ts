export type IntegrationCategory =
  | "accounting"
  | "banking"
  | "payments"
  | "email"
  | "einvoicing"
  | "developer"
  | "migration";

export type IntegrationAvailability = "available" | "coming_soon";

export type IntegrationAuthType =
  | "oauth"
  | "api_key"
  | "credentials"
  | "internal";

export type IntegrationScope = "tenant" | "company";

export type IntegrationCapability =
  | "sync_customers"
  | "sync_invoices"
  | "sync_payments"
  | "sync_bank_transactions"
  | "send_email"
  | "import_data"
  | "api_access"
  | "webhooks"
  | "einvoice";

export type IntegrationDefinition = {
  id: string;
  slug: string;
  nameKey: string;
  descriptionKey: string;
  category: IntegrationCategory;
  availability: IntegrationAvailability;
  capabilities: IntegrationCapability[];
  scope: IntegrationScope;
  authType: IntegrationAuthType;
  logoKey: string;
  recommended?: boolean;
};

export type ConnectionStatus = "connected" | "attention" | "disconnected";

export type IntegrationConnection = {
  id: string;
  integrationId: string;
  tenantId: string;
  companyId?: string;
  status: ConnectionStatus;
  connectedAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "failed";
  authLabelKey: string;
  metadata?: Record<string, string>;
};

export type IntegrationActivity = {
  id: string;
  connectionId: string;
  at: string;
  tone: "success" | "warning" | "info";
  titleKey: string;
  bodyKey?: string;
  bodyParams?: Record<string, string | number>;
};

export type IntegrationDisplayStatus =
  | "connected"
  | "ready"
  | "attention"
  | "coming_soon";

export type IntegrationSort =
  | "recommended"
  | "name"
  | "connected_first"
  | "category";

export type IntegrationFilters = {
  search: string;
  category: IntegrationCategory | "all";
  sort: IntegrationSort;
};

export const TENANT_ID = "tenant-dfm";
