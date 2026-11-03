import type { TenantPrismaClient } from '../../database/tenant-prisma.manager';
import { DataScope, DocumentStatus, PaymentStatus } from '../../generated/tenant/enums';
import type { AccessContext } from '../rbac/access';

export interface OpenInvoice {
  number: string | null;
  customer: string;
  due: string | null;
  left: number;
  lateDays: number;
}

export interface BusinessData {
  today: string;
  overdue: OpenInvoice[];
  upcoming: OpenInvoice[];
  quotes: { status: string; count: number; total: number }[];
}

/** The caller's receivables and quotes, restricted to what their data scope allows. */
export async function loadBusinessData(db: TenantPrismaClient, access: AccessContext): Promise<BusinessData> {
  const scoped = {
    ...(access.companyId && { companyId: access.companyId }),
    ...(access.scope === DataScope.OWN && { ownerId: access.userId }),
  };
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [invoices, quotes] = await Promise.all([
    db.invoice.findMany({
      where: { ...scoped, status: DocumentStatus.VALIDATED, paymentStatus: { not: PaymentStatus.PAID } },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 50,
    }),
    db.quote.groupBy({ by: ['status'], where: { ...scoped, deletedAt: null }, _count: true, _sum: { totalTtc: true } }),
  ]);

  const open: OpenInvoice[] = invoices.map((i) => ({
    number: i.number,
    customer: i.customer.name,
    due: i.dueDate?.toISOString().slice(0, 10) ?? null,
    left: Number(i.totalTtc) - Number(i.amountPaid),
    lateDays: i.dueDate ? Math.round((+today - +i.dueDate) / 864e5) : 0,
  }));
  return {
    today: today.toISOString().slice(0, 10),
    overdue: open.filter((i) => i.lateDays > 0),
    upcoming: open.filter((i) => i.lateDays <= 0),
    quotes: quotes.map((q) => ({ status: q.status, count: q._count, total: Number(q._sum.totalTtc ?? 0) })),
  };
}

const eur = (n: number) => `${n.toFixed(2)} EUR`;
const sum = (list: OpenInvoice[]) => list.reduce((s, i) => s + i.left, 0);

/** Plain-text form of the data, appended to the LLM system prompt. */
export function formatContext(d: BusinessData): string {
  return [
    `Today: ${d.today}. Live data of the user's company (amounts in EUR, tax included):`,
    `Overdue invoices (${d.overdue.length}, total ${eur(sum(d.overdue))}):`,
    ...d.overdue.map((i) => `- ${i.number} | ${i.customer} | ${eur(i.left)} left | ${i.lateDays} days late`),
    `Other unpaid invoices:`,
    ...d.upcoming.map((i) => `- ${i.number} | ${i.customer} | ${eur(i.left)} left | due ${i.due}`),
    `Quotes by status:`,
    ...d.quotes.map((q) => `- ${q.status}: ${q.count} quote(s), ${eur(q.total)}`),
  ].join('\n');
}
