import { DEFAULT_COMPANY_ID } from "@/features/settings/mocks/companies";

import type { IntegrationActivity, IntegrationConnection } from "./model";
import { TENANT_ID } from "./model";

/** Seed only real demo connections — no fake sync for coming-soon providers. */
export const seedConnections: IntegrationConnection[] = [
  {
    id: "conn-rest-api",
    integrationId: "int-rest-api",
    tenantId: TENANT_ID,
    status: "connected",
    connectedAt: "2026-08-12T09:00:00.000Z",
    lastSyncAt: undefined,
    authLabelKey: "auth.apiKey",
    metadata: { keys: "2" },
  },
  {
    id: "conn-webhooks",
    integrationId: "int-webhooks",
    tenantId: TENANT_ID,
    status: "connected",
    connectedAt: "2026-09-01T10:15:00.000Z",
    authLabelKey: "auth.internal",
    metadata: { endpoints: "1" },
  },
  {
    id: "conn-qonto-dfm",
    integrationId: "int-qonto",
    tenantId: TENANT_ID,
    companyId: DEFAULT_COMPANY_ID,
    status: "connected",
    connectedAt: "2026-09-18T08:30:00.000Z",
    lastSyncAt: "2026-10-02T14:23:00.000Z",
    lastSyncStatus: "success",
    authLabelKey: "auth.oauth",
  },
  {
    id: "conn-email-dfm",
    integrationId: "int-email",
    tenantId: TENANT_ID,
    companyId: DEFAULT_COMPANY_ID,
    status: "connected",
    connectedAt: "2026-07-22T11:00:00.000Z",
    authLabelKey: "auth.smtp",
    metadata: { from: "noreply@dfm-europe.com" },
  },
];

export const seedActivities: IntegrationActivity[] = [
  {
    id: "act-qonto-1",
    connectionId: "conn-qonto-dfm",
    at: "2026-10-02T14:23:00.000Z",
    tone: "success",
    titleKey: "activity.bankSyncDone",
    bodyKey: "activity.bankSyncBody",
    bodyParams: { count: 86 },
  },
  {
    id: "act-qonto-2",
    connectionId: "conn-qonto-dfm",
    at: "2026-10-01T13:02:00.000Z",
    tone: "success",
    titleKey: "activity.paymentSyncDone",
    bodyKey: "activity.paymentSyncBody",
    bodyParams: { count: 12 },
  },
  {
    id: "act-email-1",
    connectionId: "conn-email-dfm",
    at: "2026-10-01T09:40:00.000Z",
    tone: "info",
    titleKey: "activity.emailConfigured",
  },
  {
    id: "act-api-1",
    connectionId: "conn-rest-api",
    at: "2026-09-28T16:10:00.000Z",
    tone: "info",
    titleKey: "activity.apiKeyRotated",
  },
];
