import {
  invoiceDisplayNumber,
  invoiceTotals,
  paidCentsFor,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { quoteTotals, type QuoteRecord } from "@/features/quotes/model";

import type {
  Project,
  ProjectExpense,
  ProjectFinance,
  ProjectsKpis,
} from "./model";

/** Realized project revenue: HT of validated/sent invoices linked to the project. */
export function isRevenueInvoice(invoice: InvoiceRecord) {
  return (
    Boolean(invoice.lockedAt) ||
    invoice.status === "validated" ||
    invoice.status === "sent"
  );
}

export function projectFinance(
  project: Project,
  invoices: InvoiceRecord[],
  payments: InvoicePayment[],
  quotes: QuoteRecord[],
  expenses: ProjectExpense[],
): ProjectFinance {
  const projectInvoices = invoices.filter((invoice) =>
    project.invoiceIds.includes(invoice.id),
  );
  const revenueInvoices = projectInvoices.filter(isRevenueInvoice);
  const revenueCents = revenueInvoices.reduce(
    (sum, invoice) => sum + invoiceTotals(invoice).htCents,
    0,
  );
  const collectedCents = revenueInvoices.reduce(
    (sum, invoice) => sum + paidCentsFor(invoice.id, payments),
    0,
  );
  const outstandingCents = Math.max(0, revenueCents - collectedCents);

  const projectQuotes = quotes.filter((quote) => project.quoteIds.includes(quote.id));
  const quotedCents = projectQuotes.reduce(
    (sum, quote) => sum + quoteTotals(quote).htCents,
    0,
  );

  const costCents = expenses
    .filter(
      (expense) =>
        expense.projectId === project.id && expense.status === "approved",
    )
    .reduce((sum, expense) => sum + expense.amountCents, 0);

  const profitCents = revenueCents - costCents;
  const marginRatio =
    revenueCents > 0 ? profitCents / revenueCents : null;

  return {
    quoteCount: project.quoteIds.length,
    invoiceCount: project.invoiceIds.length,
    quotedCents,
    revenueCents,
    collectedCents,
    outstandingCents,
    costCents,
    profitCents,
    marginRatio,
  };
}

export function projectsKpis(
  projects: Project[],
  invoices: InvoiceRecord[],
  payments: InvoicePayment[],
  quotes: QuoteRecord[],
  expenses: ProjectExpense[],
): ProjectsKpis {
  // Total matches Projects tab badge: all company-scoped projects (no silent archive exclusion).
  let revenueCents = 0;
  let costCents = 0;
  for (const project of projects) {
    const finance = projectFinance(project, invoices, payments, quotes, expenses);
    revenueCents += finance.revenueCents;
    costCents += finance.costCents;
  }
  const profitCents = revenueCents - costCents;
  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.status === "active").length,
    revenueCents,
    costCents,
    profitCents,
    marginRatio: revenueCents > 0 ? profitCents / revenueCents : null,
  };
}

export function invoiceLabel(invoice: InvoiceRecord) {
  return invoiceDisplayNumber(invoice);
}
