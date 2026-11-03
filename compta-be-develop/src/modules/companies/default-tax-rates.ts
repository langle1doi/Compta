import type { Prisma } from '../../generated/tenant/client';

// French VAT rates (F03 A): 20%, 10%, 5,5%, 2,1%, 0% with its mandatory legal mention (BR-04)
const FR_TAX_RATES = [
  { rate: '20.00', label: 'TVA 20 %', isDefault: true },
  { rate: '10.00', label: 'TVA 10 %' },
  { rate: '5.50', label: 'TVA 5,5 %' },
  { rate: '2.10', label: 'TVA 2,1 %' },
  { rate: '0.00', label: 'Autoliquidation', legalMention: 'Autoliquidation - article 283-2 du CGI' },
];

/** Seeds the default tax rates of a new company (French companies only for now). */
export async function seedDefaultTaxRates(tx: Prisma.TransactionClient, companyId: string, countryCode: string) {
  if (countryCode !== 'FR') return;
  await tx.taxRate.createMany({ data: FR_TAX_RATES.map((r) => ({ ...r, companyId })), skipDuplicates: true });
}
