import type { DocumentTemplateConfig, DocumentUseCase } from "../model";

export type RenderCompany = {
  name: string;
  legalName?: string;
  address?: string;
  siret?: string;
  vatNumber?: string;
  iban?: string;
  logoUrl?: string;
  email?: string;
};

export type RenderCustomer = {
  name: string;
  address?: string;
};

export type RenderLineItem = {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPriceCents: number;
  discountPercent?: number;
  vatRate: number;
  /** Precomputed line amount HT in cents — owned by quote/invoice domain. */
  amountCents: number;
};

export type RenderTotals = {
  subtotalHtCents: number;
  vatCents: number;
  totalTtcCents: number;
  vatRate?: number;
  depositCents?: number;
};

export type RenderDocument = {
  number: string;
  title?: string;
  date: string;
  dueOrValidUntil?: string;
  reference?: string;
  currency: string;
  customer: RenderCustomer;
  lines: RenderLineItem[];
  totals: RenderTotals;
  note?: string;
};

export type DocumentRendererProps = {
  type: DocumentUseCase;
  template: {
    language: string;
    documentConfig: DocumentTemplateConfig;
  };
  company: RenderCompany;
  document: RenderDocument;
  /**
   * preview (default): scaled A4 inside paper frame
   * thumbnail: compact card thumbnail
   * full: raw A4 for print / PDF (no scale shell)
   */
  mode?: "preview" | "thumbnail" | "full";
  pageNumber?: number;
  pageCount?: number;
  expandLabel?: string;
  onExpand?: () => void;
};
