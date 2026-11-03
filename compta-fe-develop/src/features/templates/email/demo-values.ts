import { formatMoneyFromCents } from "@/lib/money";

import {
  sampleCompany,
  sampleDocumentFor,
} from "../document-preview/sample-document";
import type { DocumentUseCase } from "../model";

export function emailDemoValues(
  useCase: string,
  companyName: string,
): Record<string, string> {
  const docType: DocumentUseCase =
    useCase.includes("quote") && !useCase.includes("invoice")
      ? "quote"
      : "invoice";
  const doc = sampleDocumentFor(docType);
  return {
    "company.name": companyName || sampleCompany.name,
    "company.address": sampleCompany.address ?? "",
    "company.siret": sampleCompany.siret ?? "",
    "company.vat_no": sampleCompany.vatNumber ?? "",
    "customer.name": doc.customer.name,
    "customer.address": doc.customer.address ?? "",
    "quote.number": sampleDocumentFor("quote").number,
    "quote.date": "02/10/2026",
    "quote.valid_until": "02/12/2026",
    "quote.reference": doc.reference ?? "",
    "quote.total": formatMoneyFromCents(doc.totals.totalTtcCents),
    "invoice.number": sampleDocumentFor("invoice").number,
    "invoice.issue_date": "02/10/2026",
    "invoice.due_date": "30/10/2026",
    "invoice.total": formatMoneyFromCents(doc.totals.totalTtcCents),
    "payment.amount": formatMoneyFromCents(doc.totals.totalTtcCents),
  };
}

export function previewRecipient(useCase: string, companyName: string) {
  const values = emailDemoValues(useCase, companyName);
  return {
    from: `${companyName} <noreply@dfm-europe.com>`,
    to: `${values["customer.name"]} <billing@nord-architecture.com>`,
    customerName: values["customer.name"],
  };
}
