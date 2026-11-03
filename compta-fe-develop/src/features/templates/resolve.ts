import type { TemplateLanguage, TemplateRecord } from "./model";

/**
 * Resolve quote document template for preview/PDF.
 * Customer-specific override is only applied when an id is provided
 * by the Customer module — no hidden persistence invented here.
 */
export function resolveQuoteTemplate(
  templates: TemplateRecord[],
  input: {
    companyId: string;
    language: TemplateLanguage;
    customerQuoteTemplateId?: string | null;
  },
): TemplateRecord | null {
  if (input.customerQuoteTemplateId) {
    const customerSpecific = templates.find(
      (item) =>
        item.id === input.customerQuoteTemplateId &&
        item.companyId === input.companyId &&
        item.type === "document" &&
        item.useCase === "quote" &&
        item.status === "active",
    );
    if (customerSpecific) return customerSpecific;
  }

  const companyDefault = templates.find(
    (item) =>
      item.companyId === input.companyId &&
      item.type === "document" &&
      item.useCase === "quote" &&
      item.language === input.language &&
      item.isDefault &&
      item.status === "active",
  );
  if (companyDefault) return companyDefault;

  return (
    templates.find(
      (item) =>
        item.companyId === input.companyId &&
        item.type === "document" &&
        item.useCase === "quote" &&
        item.status === "active",
    ) ?? null
  );
}

export function resolveInvoiceTemplate(
  templates: TemplateRecord[],
  input: {
    companyId: string;
    language: TemplateLanguage;
  },
): TemplateRecord | null {
  return (
    templates.find(
      (item) =>
        item.companyId === input.companyId &&
        item.type === "document" &&
        item.useCase === "invoice" &&
        item.language === input.language &&
        item.isDefault &&
        item.status === "active",
    ) ??
    templates.find(
      (item) =>
        item.companyId === input.companyId &&
        item.type === "document" &&
        item.useCase === "invoice" &&
        item.status === "active",
    ) ??
    null
  );
}
