import type { TemplateLanguage, TemplateStatus, TemplateType, TemplateUseCase } from "./model";

export function labelForUseCase(useCase: TemplateUseCase): string {
  const map: Record<TemplateUseCase, string> = {
    quote: "Quote",
    invoice: "Invoice",
    credit_note: "Credit note",
    payment_reminder: "Payment reminder",
    quote_follow_up: "Quote follow-up",
    quote_email: "Quote email",
    invoice_email: "Invoice email",
  };
  return map[useCase];
}

export function typeLabel(type: TemplateType): string {
  return type === "document" ? "Document" : "Email";
}

export function languageLabel(language: TemplateLanguage): string {
  return language.toUpperCase();
}

export function statusLabel(status: TemplateStatus): string {
  return status === "active" ? "Active" : "Inactive";
}

export function formatUpdatedAt(iso: string, locale = "en") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
