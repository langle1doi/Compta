import type { DocumentUseCase } from "../model";
import type { RenderCompany, RenderDocument } from "./types";

export const sampleCompany: RenderCompany = {
  name: "DFM-Europe",
  legalName: "DFM-Europe SAS",
  address: "12 rue de la Paix\n75002 Paris, France",
  siret: "812 345 678 00019",
  vatNumber: "FR42812345678",
  iban: "FR76 3000 6000 0112 3456 7890 189",
  email: "contact@dfm-europe.com",
};

const baseLines = [
  {
    id: "line-1",
    title: "Consulting",
    description: "Technical consulting services",
    quantity: 20,
    unit: "h",
    unitPriceCents: 15000,
    vatRate: 20,
    amountCents: 300000,
  },
  {
    id: "line-2",
    title: "Project management",
    description: "Coordination and delivery oversight",
    quantity: 8,
    unit: "d",
    unitPriceCents: 65000,
    vatRate: 20,
    amountCents: 520000,
  },
  {
    id: "line-3",
    title: "Materials",
    description: "Supply package for office renovation",
    quantity: 1,
    unit: "lot",
    unitPriceCents: 100000,
    vatRate: 20,
    amountCents: 100000,
  },
];

export function sampleDocumentFor(type: DocumentUseCase): RenderDocument {
  const isInvoice = type === "invoice" || type === "credit_note";
  return {
    number: isInvoice
      ? type === "credit_note"
        ? "AVO20260112"
        : "FAC20260148"
      : "DEV20260148",
    title: undefined,
    date: "2026-10-02",
    dueOrValidUntil: isInvoice ? "2026-10-30" : "2026-12-02",
    reference: "OFFICE-RENOVATION",
    currency: "EUR",
    customer: {
      name: "Nord Architecture",
      address: "1 Rue de la Loi\n1000 Brussels, Belgium",
    },
    lines: baseLines,
    totals: {
      subtotalHtCents: 920000,
      vatCents: 184000,
      totalTtcCents: 1104000,
      vatRate: 20,
    },
  };
}

/** Extra lines to demonstrate multi-page flow in print/preview. */
export function longSampleDocument(type: DocumentUseCase): RenderDocument {
  const base = sampleDocumentFor(type);
  const extra = Array.from({ length: 18 }, (_, index) => ({
    id: `extra-${index + 1}`,
    title: `Additional service ${index + 1}`,
    description: "Extended scope item for pagination preview",
    quantity: 1,
    unit: "u",
    unitPriceCents: 12000,
    vatRate: 20,
    amountCents: 12000,
  }));
  const lines = [...base.lines, ...extra];
  const subtotalHtCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const vatCents = Math.round(subtotalHtCents * 0.2);
  return {
    ...base,
    lines,
    totals: {
      subtotalHtCents,
      vatCents,
      totalTtcCents: subtotalHtCents + vatCents,
      vatRate: 20,
    },
  };
}
