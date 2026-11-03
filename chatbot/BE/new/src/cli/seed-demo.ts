/**
 * Sample data for demoing the chat assistant: customers, quotes, invoices and payments in one tenant.
 * Usage: npm run db:demo:seed [-- --tenant=dfm]. Safe to run again: does nothing when DEMO-* customers exist.
 */
import { CustomerType, DocumentStatus, PaymentMethod, PaymentStatus, QuoteStatus } from '../generated/tenant/enums';
import { TenantRegistryService } from '../modules/tenancy/tenant-registry.service';
import { runCli, withAppContext } from './cli-context';

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const ttc = (ht: number) => Math.round(ht * 1.2 * 100) / 100;

// [name, invoices: [ht, dueInDays, paid share], quotes: [ht, status]]
const CUSTOMERS: { name: string; invoices: [number, number, number][]; quotes: [number, QuoteStatus][] }[] = [
  { name: 'Maison Laurent', invoices: [[2066.67, -12, 0]], quotes: [[9800, QuoteStatus.PENDING_APPROVAL]] },
  { name: 'Atelier Nord', invoices: [[958.33, -5, 0]], quotes: [[4200, QuoteStatus.SENT]] },
  { name: 'Verde Agro', invoices: [[716.67, -1, 0], [3000, 20, 0]], quotes: [[7500, QuoteStatus.ACCEPTED]] },
  { name: 'Studio Helios', invoices: [[800, 10, 0.6], [1500, -40, 1]], quotes: [[3100, QuoteStatus.DRAFT], [5600, QuoteStatus.SENT]] },
];

export function seedDemo(only = 'dfm') {
  return withAppContext(async (app) => {
    const registry = app.get(TenantRegistryService);
    const tenant = await registry.findBySubdomain(only);
    if (!tenant) throw new Error(`Tenant "${only}" not found: run db:control:seed first`);
    const db = registry.clientFor(tenant);

    if ((await db.customer.count({ where: { code: { startsWith: 'DEMO-' } } })) > 0) return 'already seeded';
    const company = await db.company.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
    const owner = await db.user.findFirstOrThrow({ where: { email: `owner@${only}.local` } });

    let n = 0;
    for (const [i, c] of CUSTOMERS.entries()) {
      const customer = await db.customer.create({
        data: { companyId: company.id, code: `DEMO-${i + 1}`, type: CustomerType.COMPANY, name: c.name, ownerId: owner.id, createdById: owner.id },
      });
      for (const [ht, dueIn, paidShare] of c.invoices) {
        n += 1;
        const total = ttc(ht);
        const paid = Math.round(total * paidShare * 100) / 100;
        const invoice = await db.invoice.create({
          data: {
            companyId: company.id,
            customerId: customer.id,
            ownerId: owner.id,
            number: `FAC-DEMO-${String(n).padStart(3, '0')}`,
            status: DocumentStatus.VALIDATED,
            paymentStatus: paid >= total ? PaymentStatus.PAID : paid > 0 ? PaymentStatus.PARTIALLY_PAID : dueIn < 0 ? PaymentStatus.OVERDUE : PaymentStatus.UNPAID,
            issueDate: day(dueIn - 30),
            dueDate: day(dueIn),
            currency: company.currency,
            totalHt: ht,
            totalVat: Math.round((total - ht) * 100) / 100,
            totalTtc: total,
            amountPaid: paid,
          },
        });
        if (paid > 0) {
          await db.payment.create({
            data: { companyId: company.id, invoiceId: invoice.id, amount: paid, currency: company.currency, paidAt: day(-3), method: PaymentMethod.BANK_TRANSFER },
          });
        }
      }
      for (const [j, [ht, status]] of c.quotes.entries()) {
        await db.quote.create({
          data: {
            companyId: company.id,
            customerId: customer.id,
            ownerId: owner.id,
            number: `DEV-DEMO-${i + 1}${j + 1}`,
            status,
            issueDate: day(-10),
            validUntil: day(20),
            currency: company.currency,
            totalHt: ht,
            totalVat: Math.round((ttc(ht) - ht) * 100) / 100,
            totalTtc: ttc(ht),
          },
        });
      }
    }
    return `seeded ${CUSTOMERS.length} customers, ${n} invoices`;
  });
}

if (require.main === module) {
  const only = process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1];
  runCli(async () => console.log(await seedDemo(only)));
}
