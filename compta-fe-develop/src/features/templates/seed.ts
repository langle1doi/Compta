import {
  defaultDocumentConfig,
  defaultEmailConfig,
  type TemplateRecord,
} from "./model";

const COMPANY_ID = "co-dfm-europe";
const COMPANY_NAME = "DFM-Europe";
const FOOTER =
  "DFM-Europe · SIRET 812 345 678 00019 · VAT FR42812345678 · contact@dfm-europe.com";

function doc(
  partial: Omit<TemplateRecord, "type" | "documentConfig" | "isSystem"> & {
    documentConfig?: TemplateRecord["documentConfig"];
    isSystem?: boolean;
  },
): TemplateRecord {
  const { documentConfig, isSystem, ...rest } = partial;
  return {
    ...rest,
    type: "document",
    isSystem: isSystem ?? true,
    documentConfig: {
      ...defaultDocumentConfig(),
      footer: FOOTER,
      ...documentConfig,
    },
  };
}

function email(
  partial: Omit<TemplateRecord, "type" | "emailConfig" | "isSystem"> & {
    emailConfig?: TemplateRecord["emailConfig"];
    isSystem?: boolean;
  },
): TemplateRecord {
  const { emailConfig, isSystem, ...rest } = partial;
  return {
    ...rest,
    type: "email",
    isSystem: isSystem ?? true,
    emailConfig: {
      ...defaultEmailConfig(
        rest.useCase as
          | "payment_reminder"
          | "quote_follow_up"
          | "quote_email"
          | "invoice_email",
      ),
      ...emailConfig,
    },
  };
}

export const seedTemplates: TemplateRecord[] = [
  doc({
    id: "tpl-quote-fr",
    name: "Standard Quote",
    useCase: "quote",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "fr",
    status: "active",
    isDefault: true,
    createdBy: "Marie Dupont",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-09-10T14:00:00.000Z",
  }),
  doc({
    id: "tpl-quote-en",
    name: "Standard Quote",
    useCase: "quote",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "en",
    status: "active",
    isDefault: true,
    createdBy: "Marie Dupont",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-09-10T14:00:00.000Z",
  }),
  doc({
    id: "tpl-invoice-fr",
    name: "Standard Invoice",
    useCase: "invoice",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "fr",
    status: "active",
    isDefault: true,
    createdBy: "Marie Dupont",
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-09-12T11:00:00.000Z",
  }),
  doc({
    id: "tpl-invoice-en",
    name: "Standard Invoice",
    useCase: "invoice",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "en",
    status: "active",
    isDefault: true,
    createdBy: "Marie Dupont",
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-09-12T11:00:00.000Z",
  }),
  doc({
    id: "tpl-credit-fr",
    name: "Credit Note",
    useCase: "credit_note",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "fr",
    status: "active",
    isDefault: true,
    createdBy: "Marie Dupont",
    createdAt: "2026-08-05T10:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
  }),
  doc({
    id: "tpl-quote-modern",
    name: "Modern Quote",
    useCase: "quote",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "fr",
    status: "active",
    isDefault: false,
    isSystem: false,
    createdBy: "Léa Bernard",
    createdAt: "2026-09-15T10:00:00.000Z",
    updatedAt: "2026-10-01T16:00:00.000Z",
    documentConfig: {
      ...defaultDocumentConfig(),
      primaryColor: "#0f766e",
      accentColor: "#ecfdf5",
      footer: `${COMPANY_NAME} · contact@dfm-europe.com`,
    },
  }),
  email({
    id: "tpl-reminder-fr",
    name: "Payment Reminder",
    useCase: "payment_reminder",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "fr",
    status: "active",
    isDefault: true,
    createdBy: "Marie Dupont",
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
  }),
  email({
    id: "tpl-reminder-en",
    name: "Payment Reminder",
    useCase: "payment_reminder",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "en",
    status: "active",
    isDefault: true,
    createdBy: "Marie Dupont",
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
  }),
  email({
    id: "tpl-followup-fr",
    name: "Quote Follow-up",
    useCase: "quote_follow_up",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "fr",
    status: "active",
    isDefault: true,
    createdBy: "Léa Bernard",
    createdAt: "2026-08-12T10:00:00.000Z",
    updatedAt: "2026-09-18T10:00:00.000Z",
  }),
  email({
    id: "tpl-invoice-mail-fr",
    name: "Invoice Email",
    useCase: "invoice_email",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "fr",
    status: "active",
    isDefault: true,
    createdBy: "Marie Dupont",
    createdAt: "2026-08-14T10:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
  }),
  email({
    id: "tpl-quote-mail-en",
    name: "Quote Email",
    useCase: "quote_email",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "en",
    status: "active",
    isDefault: true,
    createdBy: "Léa Bernard",
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-09-25T10:00:00.000Z",
  }),
  email({
    id: "tpl-reminder-firm",
    name: "Payment Reminder — Firm",
    useCase: "payment_reminder",
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    language: "en",
    status: "inactive",
    isDefault: false,
    isSystem: false,
    createdBy: "Nicolas Petit",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-28T10:00:00.000Z",
    emailConfig: {
      subject: "Final reminder — Invoice {{invoice.number}}",
      body: "Hello {{customer.name}},\n\nYour invoice {{invoice.number}} ({{invoice.total}}) is overdue since {{invoice.due_date}}.\n\nPlease settle the balance without delay.",
      signature: "{{company.name}} — Accounting",
    },
  }),
];
