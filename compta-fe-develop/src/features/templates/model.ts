export type TemplateType = "document" | "email";

export type DocumentUseCase = "quote" | "invoice" | "credit_note";

export type EmailUseCase =
  | "payment_reminder"
  | "quote_follow_up"
  | "quote_email"
  | "invoice_email";

export type TemplateUseCase = DocumentUseCase | EmailUseCase;

export type TemplateLanguage = "fr" | "en" | "vi";

export type TemplateStatus = "active" | "inactive";

export type DocumentTemplateConfig = {
  primaryColor: string;
  accentColor: string;
  textColor: string;
  showLogo: boolean;
  showCompanyAddress: boolean;
  showSiret: boolean;
  showVatNumber: boolean;
  showCustomerBlock: boolean;
  showDescription: boolean;
  showQuantity: boolean;
  showUnit: boolean;
  showUnitPrice: boolean;
  showDiscount: boolean;
  showVat: boolean;
  showAmount: boolean;
  terms: string;
  footer: string;
  showPageNumber: boolean;
};

export type EmailTemplateConfig = {
  subject: string;
  body: string;
  signature: string;
};

export type TemplateRecord = {
  id: string;
  name: string;
  type: TemplateType;
  useCase: TemplateUseCase;
  companyId: string;
  companyName: string;
  language: TemplateLanguage;
  status: TemplateStatus;
  isDefault: boolean;
  isSystem: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  documentConfig?: DocumentTemplateConfig;
  emailConfig?: EmailTemplateConfig;
};

export type TemplatesKpis = {
  total: number;
  active: number;
  custom: number;
  defaults: number;
};

export type TemplateFilters = {
  search: string;
  type: TemplateType | "all";
  useCase: TemplateUseCase | "all";
  language: TemplateLanguage | "all";
  status: TemplateStatus | "all";
  sort: "updated" | "name" | "created";
};

export type TemplateViewMode = "grid" | "list";

export const defaultDocumentConfig = (): DocumentTemplateConfig => ({
  primaryColor: "#1467f3",
  accentColor: "#eaf2ff",
  textColor: "#17233c",
  showLogo: true,
  showCompanyAddress: true,
  showSiret: true,
  showVatNumber: true,
  showCustomerBlock: true,
  showDescription: true,
  showQuantity: true,
  showUnit: true,
  showUnitPrice: true,
  showDiscount: false,
  showVat: true,
  showAmount: true,
  terms:
    "1. This document is valid for 30 days.\n2. Payment terms: 30 days from invoice date.\n3. Work will be scheduled after confirmation.",
  footer: "",
  showPageNumber: true,
});

export const defaultEmailConfig = (
  useCase: EmailUseCase,
): EmailTemplateConfig => {
  if (useCase === "payment_reminder") {
    return {
      subject: "Reminder — Invoice {{invoice.number}}",
      body: "Hello {{customer.name}},\n\nThis is a reminder regarding invoice {{invoice.number}} for {{invoice.total}}.\n\nPayment is due on {{invoice.due_date}}.\n\nThank you.",
      signature: "{{company.name}}\n{{company.address}}",
    };
  }
  if (useCase === "quote_follow_up") {
    return {
      subject: "Following up on quote {{quote.number}}",
      body: "Hello {{customer.name}},\n\nI wanted to follow up on quote {{quote.number}} sent earlier.\n\nPlease let us know if you have any questions.\n\nBest regards",
      signature: "{{company.name}}",
    };
  }
  if (useCase === "invoice_email") {
    return {
      subject: "Invoice {{invoice.number}} from {{company.name}}",
      body: "Hello {{customer.name}},\n\nPlease find attached invoice {{invoice.number}} for {{invoice.total}}.\n\nPayment is due on {{invoice.due_date}}.",
      signature: "{{company.name}}",
    };
  }
  return {
    subject: "Quote {{quote.number}} from {{company.name}}",
    body: "Hello {{customer.name}},\n\nPlease find attached quote {{quote.number}} for {{quote.total}}.\n\nValid until {{quote.valid_until}}.",
    signature: "{{company.name}}",
  };
};
