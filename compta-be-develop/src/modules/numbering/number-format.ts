import { DocumentType } from '../../generated/tenant/enums';

/** Default formats (F03): DEV{YYYY}{NNNN}, FAC{YYYY}{NNNN}, AV{YYYY}{NNNN}; customer codes C00001 (F06 AC-01). */
export const DEFAULT_FORMATS: Record<DocumentType, string> = {
  [DocumentType.CUSTOMER]: 'C{NNNNN}',
  [DocumentType.QUOTE]: 'DEV{YYYY}{NNNN}',
  [DocumentType.INVOICE]: 'FAC{YYYY}{NNNN}',
  [DocumentType.CREDIT_NOTE]: 'AV{YYYY}{NNNN}',
};

/** Sequences that never reset use year 0. */
export const YEARLESS: ReadonlySet<DocumentType> = new Set([DocumentType.CUSTOMER]);

const TOKEN = /\{(YYYY|N+)\}/g;

export function isValidFormat(format: string): boolean {
  return /\{N+\}/.test(format) && format.replace(TOKEN, '').length <= 20 && !/[{}]/.test(format.replace(TOKEN, ''));
}

/** Renders a number: {YYYY} -> year, {NNNN} -> counter zero-padded to the number of N (never truncated). */
export function renderNumber(format: string, year: number, value: number): string {
  return format.replace(TOKEN, (_, token: string) => (token === 'YYYY' ? String(year) : String(value).padStart(token.length, '0')));
}
