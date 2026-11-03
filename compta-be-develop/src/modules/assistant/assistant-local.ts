import type { BusinessData, OpenInvoice } from './assistant-context';

type Locale = 'fr' | 'en';

const QUOTE_LABEL: Record<string, Record<Locale, string>> = {
  DRAFT: { fr: 'Brouillons', en: 'Draft' },
  PENDING_APPROVAL: { fr: 'À approuver', en: 'To approve' },
  SENT: { fr: 'Envoyés', en: 'Sent' },
  ACCEPTED: { fr: 'Acceptés', en: 'Accepted' },
  REJECTED: { fr: 'Refusés', en: 'Rejected' },
  EXPIRED: { fr: 'Expirés', en: 'Expired' },
  INVOICED: { fr: 'Facturés', en: 'Invoiced' },
};

// Checked in order: the first intent with a matching keyword wins.
const INTENTS: { name: 'owe' | 'quotes' | 'overdue'; words: string[] }[] = [
  { name: 'owe', words: ['solde', 'owe', 'doit', 'debt', 'creance', 'receivable', 'balance'] },
  { name: 'quotes', words: ['devis', 'quote', 'pipeline'] },
  { name: 'overdue', words: ['retard', 'overdue', 'impay', 'unpaid', 'late', 'relance', 'reminder', 'facture', 'invoice'] },
];

const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Answers from the data alone, with keyword matching: the fallback when no LLM is available. */
export function localReply(question: string, d: BusinessData, locale: Locale): string {
  const fr = locale === 'fr';
  const money = (n: number) => n.toLocaleString(fr ? 'fr-FR' : 'en-GB', { style: 'currency', currency: 'EUR' });
  const total = (list: OpenInvoice[]) => list.reduce((s, i) => s + i.left, 0);
  const text = normalize(question);
  const intent = INTENTS.find((i) => i.words.some((w) => text.includes(w)))?.name;

  if (intent === 'overdue') {
    if (d.overdue.length === 0) return fr ? 'Aucune facture en retard.' : 'No overdue invoices.';
    return [
      fr ? `Factures en retard (${d.overdue.length}) :` : `Overdue invoices (${d.overdue.length}):`,
      '',
      ...d.overdue.map((i) => `• ${i.number} — ${i.customer} — ${money(i.left)} — ${i.lateDays} ${fr ? 'j de retard' : 'days late'}`),
      '',
      `Total : ${money(total(d.overdue))}`,
    ].join('\n');
  }

  if (intent === 'quotes') {
    if (d.quotes.length === 0) return fr ? 'Aucun devis.' : 'No quotes.';
    return [
      fr ? 'Pipeline de devis :' : 'Quote pipeline:',
      '',
      ...d.quotes.map((q) => `• ${QUOTE_LABEL[q.status]?.[locale] ?? q.status} : ${q.count} · ${money(q.total)}`),
    ].join('\n');
  }

  if (intent === 'owe') {
    const byCustomer = new Map<string, number>();
    for (const i of [...d.overdue, ...d.upcoming]) byCustomer.set(i.customer, (byCustomer.get(i.customer) ?? 0) + i.left);
    if (byCustomer.size === 0) return fr ? 'Aucun solde dû.' : 'No open balances.';
    return [
      fr ? 'Soldes ouverts par client :' : 'Open balances by customer:',
      '',
      ...[...byCustomer].sort((a, b) => b[1] - a[1]).map(([name, left], k) => `${k + 1}. ${name} — ${money(left)}`),
      '',
      `Total : ${money(total([...d.overdue, ...d.upcoming]))}`,
    ].join('\n');
  }

  return fr
    ? 'Je peux répondre sur : les factures en retard, le pipeline de devis, et les clients qui ont un solde dû. Essayez l’une de ces questions.'
    : 'I can answer about: overdue invoices, the quote pipeline, and customers with an open balance. Try one of those questions.';
}
