"use client";

import { FileText, Link2, ReceiptText, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";
import { SoftSelect } from "@/components/compte/soft-select";
import { FormSheet } from "@/components/forms/form-sheet";
import { StatusBadge } from "@/components/dashboard/tone";
import {
  invoiceDisplayNumber,
  invoiceTotals,
  paidCentsFor,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/features/invoices/model";
import { quoteTotals, type QuoteRecord } from "@/features/quotes/model";
import { owners } from "@/features/quotes/seed";
import { mockCompanies } from "@/features/settings/mocks/companies";
import { formatMoneyFromCents, formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

import { invoiceLabel, projectFinance } from "../finance";
import type { Project, ProjectActivity, ProjectExpense, ProjectStatus } from "../model";
import { expenseStatusTone, projectStatusTone } from "../status";
import {
  linkInvoiceToProject,
  linkQuoteToProject,
  setProjectStatus,
} from "../store";

const PROJECT_STATUSES: ProjectStatus[] = [
  "draft",
  "active",
  "on_hold",
  "completed",
  "archived",
];

type DetailTab = "overview" | "quotes" | "invoices" | "costs" | "activity";

export function ProjectDetailSheet({
  open,
  project,
  quotes,
  invoices,
  payments,
  expenses,
  activities,
  canReadExpenses,
  canUpdate,
  canViewFinance,
  onClose,
  onOpenQuote,
  onOpenInvoice,
  onCreateQuote,
}: {
  open: boolean;
  project: Project | null;
  quotes: QuoteRecord[];
  invoices: InvoiceRecord[];
  payments: InvoicePayment[];
  expenses: ProjectExpense[];
  activities: ProjectActivity[];
  canReadExpenses: boolean;
  canUpdate: boolean;
  canViewFinance: boolean;
  onClose: () => void;
  onOpenQuote: (quoteId: string) => void;
  onOpenInvoice: (invoiceId: string) => void;
  onCreateQuote?: () => void;
}) {
  const t = useTranslations("projects");
  const [tab, setTab] = useState<DetailTab>("overview");
  const [linkQuoteId, setLinkQuoteId] = useState("");
  const [linkInvoiceId, setLinkInvoiceId] = useState("");

  const finance = useMemo(() => {
    if (!project) return null;
    return projectFinance(project, invoices, payments, quotes, expenses);
  }, [expenses, invoices, payments, project, quotes]);

  const companyName =
    mockCompanies.find((company) => company.id === project?.companyId)?.name ??
    project?.companyId ??
    "—";

  const linkedQuotes = useMemo(() => {
    if (!project) return [];
    return quotes.filter((quote) => project.quoteIds.includes(quote.id));
  }, [project, quotes]);

  const linkedInvoices = useMemo(() => {
    if (!project) return [];
    return invoices.filter((invoice) => project.invoiceIds.includes(invoice.id));
  }, [invoices, project]);

  const linkedExpenses = useMemo(() => {
    if (!project) return [];
    return expenses.filter((expense) => expense.projectId === project.id);
  }, [expenses, project]);

  const projectActivities = useMemo(() => {
    if (!project) return [];
    return activities
      .filter((item) => item.projectId === project.id)
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [activities, project]);

  const quoteOptions = useMemo(() => {
    if (!project) return [];
    // Same customer only — products enter via quote lines, not Project create.
    return quotes
      .filter(
        (quote) =>
          !project.quoteIds.includes(quote.id) &&
          quote.customerId === project.customerId,
      )
      .map((quote) => ({
        value: quote.id,
        label: quote.id,
      }));
  }, [project, quotes]);

  const invoiceOptions = useMemo(() => {
    if (!project) return [];
    return invoices
      .filter(
        (invoice) =>
          !project.invoiceIds.includes(invoice.id) &&
          invoice.customerId === project.customerId,
      )
      .map((invoice) => ({
        value: invoice.id,
        label: invoiceDisplayNumber(invoice),
      }));
  }, [invoices, project]);

  if (!project || !finance) return null;

  const tabs: DetailTab[] = canReadExpenses
    ? ["overview", "quotes", "invoices", "costs", "activity"]
    : ["overview", "quotes", "invoices", "activity"];

  return (
    <FormSheet
      open={open}
      showHeader={false}
      title={project.name}
      contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
      widthClassName="w-full sm:w-[min(100%,680px)] sm:max-w-[680px]"
      zIndexClassName="z-[70]"
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e8eef6] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tabular-nums text-[#7d8aa0]">
              {project.code}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold tracking-[-0.02em] text-[#063586]">
              {project.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {canUpdate ? (
                <div className="w-[148px] shrink-0">
                  <SoftSelect
                    hideLabel
                    label={t("form.status")}
                    options={PROJECT_STATUSES.map((value) => ({
                      value,
                      label: t(`status.${value}`),
                    }))}
                    triggerClassName="h-8"
                    value={project.status}
                    onChange={(value) =>
                      setProjectStatus(project.id, value as ProjectStatus)
                    }
                  />
                </div>
              ) : (
                <StatusBadge size="xs" tone={projectStatusTone[project.status]}>
                  {t(`status.${project.status}`)}
                </StatusBadge>
              )}
              <span className="text-[11px] text-[#7d8aa0]">{project.customerName}</span>
              <span className="text-[11px] text-[#98a4b5]">· {companyName}</span>
            </div>
          </div>
          <button
            aria-label={t("form.close")}
            className="soft-button grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[#506078]"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <AnimatedSelectionGroup className="shrink-0 px-4 pt-3 sm:px-5" id="project-detail-tabs">
          <div
            aria-label={t("detail.tabsLabel")}
            className="flex min-w-0 gap-1 overflow-x-auto"
            role="tablist"
          >
            {tabs.map((item) => {
              const active = tab === item;
              return (
                <button
                  aria-selected={active}
                  className={cn(
                    "relative shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    active ? "text-[#2458d6]" : "text-[#7d8aa0] hover:text-[#405069]",
                  )}
                  key={item}
                  role="tab"
                  type="button"
                  onClick={() => setTab(item)}
                >
                  {active ? (
                    <AnimatedActiveIndicator
                      className="rounded-full"
                      layoutId="project-detail-tab"
                      variant="soft-pill"
                    />
                  ) : null}
                  <span className="relative z-[1]">{t(`detail.tabs.${item}`)}</span>
                </button>
              );
            })}
          </div>
        </AnimatedSelectionGroup>

        <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {tab === "overview" ? (
            <div className="space-y-4" style={{ animation: "compte-tab-in 160ms ease-out" }}>
              <section className="rounded-[12px] border border-[#edf2f8] px-3 py-3">
                <h3 className="text-[12px] font-semibold text-[#24334c]">
                  {t("detail.info")}
                </h3>
                <p className="mt-2 text-xs leading-5 text-[#516078]">
                  {project.description || t("detail.noDescription")}
                </p>
                <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Meta label={t("form.startDate")} value={project.startDate ?? "—"} />
                  <Meta label={t("form.endDate")} value={project.endDate ?? "—"} />
                </dl>
              </section>

              <section className="rounded-[12px] border border-[#edf2f8] px-3 py-3">
                <h3 className="text-[12px] font-semibold text-[#24334c]">
                  {t("detail.financial")}
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <FinanceCell
                    label={t("columns.revenue")}
                    value={
                      canViewFinance
                        ? formatMoneyFromCents(finance.revenueCents)
                        : t("finance.masked")
                    }
                  />
                  <FinanceCell
                    label={t("columns.costs")}
                    value={
                      canViewFinance
                        ? formatMoneyFromCents(finance.costCents)
                        : t("finance.masked")
                    }
                  />
                  <FinanceCell
                    label={t("columns.profit")}
                    value={
                      canViewFinance
                        ? formatMoneyFromCents(finance.profitCents)
                        : t("finance.masked")
                    }
                  />
                  <FinanceCell
                    label={t("columns.margin")}
                    value={
                      canViewFinance
                        ? finance.marginRatio === null
                          ? t("kpis.na")
                          : formatPercent(finance.marginRatio)
                        : t("finance.masked")
                    }
                  />
                </div>
                {canViewFinance ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <FinanceCell
                      label={t("detail.quoted")}
                      value={formatMoneyFromCents(finance.quotedCents)}
                      muted
                    />
                    <FinanceCell
                      label={t("detail.invoiced")}
                      value={formatMoneyFromCents(finance.revenueCents)}
                      muted
                    />
                    <FinanceCell
                      label={t("detail.collected")}
                      value={formatMoneyFromCents(finance.collectedCents)}
                      muted
                    />
                    <FinanceCell
                      label={t("detail.outstanding")}
                      value={formatMoneyFromCents(finance.outstandingCents)}
                      muted
                    />
                  </div>
                ) : null}
              </section>

              <section className="rounded-[12px] border border-[#edf2f8] px-3 py-3">
                <h3 className="text-[12px] font-semibold text-[#24334c]">
                  {t("detail.linked")}
                </h3>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#516078]">
                  <span>
                    {t("columns.quotes")}: <strong>{finance.quoteCount}</strong>
                  </span>
                  <span>
                    {t("columns.invoices")}: <strong>{finance.invoiceCount}</strong>
                  </span>
                  <span>
                    {t("detail.expenses")}: <strong>{linkedExpenses.length}</strong>
                  </span>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "quotes" ? (
            <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
              {canUpdate ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <SoftSelect
                      label={t("detail.linkQuote")}
                      options={[
                        { value: "", label: t("detail.selectQuote") },
                        ...quoteOptions,
                      ]}
                      value={linkQuoteId}
                      onChange={setLinkQuoteId}
                    />
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {onCreateQuote ? (
                      <button
                        className="action-motion soft-button inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
                        type="button"
                        onClick={onCreateQuote}
                      >
                        {t("detail.createQuote")}
                      </button>
                    ) : null}
                    <button
                      className="action-motion soft-primary inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-xs font-semibold text-white disabled:opacity-50"
                      disabled={!linkQuoteId}
                      type="button"
                      onClick={() => {
                        if (!linkQuoteId) return;
                        linkQuoteToProject(project.id, linkQuoteId);
                        setLinkQuoteId("");
                      }}
                    >
                      <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                      {t("detail.linkQuote")}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-[12px] border border-[#edf2f8]">
                <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
                  <thead className="bg-[#f8fafc] text-[#7d8aa0]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{t("detail.quoteNumber")}</th>
                      <th className="px-3 py-2 font-semibold">{t("detail.date")}</th>
                      <th className="px-3 py-2 font-semibold">{t("columns.status")}</th>
                      <th className="px-3 py-2 font-semibold">{t("detail.htTtc")}</th>
                      <th className="px-3 py-2 font-semibold">{t("columns.customer")}</th>
                      <th className="px-3 py-2 font-semibold">{t("detail.owner")}</th>
                      <th className="px-3 py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {linkedQuotes.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-[#98a4b5]" colSpan={7}>
                          {t("detail.noQuotes")}
                        </td>
                      </tr>
                    ) : (
                      linkedQuotes.map((quote) => {
                        const totals = quoteTotals(quote);
                        const owner =
                          owners.find((item) => item.id === quote.ownerId)?.name ??
                          quote.ownerId;
                        return (
                          <tr className="border-t border-[#edf2f8]" key={quote.id}>
                            <td className="px-3 py-2 font-semibold tabular-nums text-[#24334c]">
                              {quote.id}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-[#516078]">
                              {quote.createdAt.slice(0, 10)}
                            </td>
                            <td className="px-3 py-2 capitalize text-[#516078]">
                              {quote.status}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-[#516078]">
                              {formatMoneyFromCents(totals.htCents)} /{" "}
                              {formatMoneyFromCents(totals.ttcCents)}
                            </td>
                            <td className="px-3 py-2 text-[#516078]">{quote.customerId}</td>
                            <td className="px-3 py-2 text-[#516078]">{owner}</td>
                            <td className="px-3 py-2">
                              <button
                                className="action-motion text-[11px] font-semibold text-[#044ce2]"
                                type="button"
                                onClick={() => onOpenQuote(quote.id)}
                              >
                                {t("detail.viewQuote")}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "invoices" ? (
            <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
              {canUpdate ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <SoftSelect
                      label={t("detail.linkInvoice")}
                      options={[
                        { value: "", label: t("detail.selectInvoice") },
                        ...invoiceOptions,
                      ]}
                      value={linkInvoiceId}
                      onChange={setLinkInvoiceId}
                    />
                  </div>
                  <button
                    className="action-motion soft-primary inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] px-3 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={!linkInvoiceId}
                    type="button"
                    onClick={() => {
                      if (!linkInvoiceId) return;
                      const invoice = invoices.find((item) => item.id === linkInvoiceId);
                      if (!invoice) return;
                      linkInvoiceToProject(project.id, invoice.id, invoiceLabel(invoice));
                      setLinkInvoiceId("");
                    }}
                  >
                    <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                    {t("detail.linkInvoice")}
                  </button>
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-[12px] border border-[#edf2f8]">
                <table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
                  <thead className="bg-[#f8fafc] text-[#7d8aa0]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{t("detail.invoiceNumber")}</th>
                      <th className="px-3 py-2 font-semibold">{t("detail.issueDate")}</th>
                      <th className="px-3 py-2 font-semibold">{t("detail.dueDate")}</th>
                      <th className="px-3 py-2 font-semibold">{t("columns.status")}</th>
                      <th className="px-3 py-2 font-semibold">{t("expense.amount")}</th>
                      <th className="px-3 py-2 font-semibold">{t("detail.paid")}</th>
                      <th className="px-3 py-2 font-semibold">{t("detail.remaining")}</th>
                      <th className="px-3 py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {linkedInvoices.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-[#98a4b5]" colSpan={8}>
                          {t("detail.noInvoices")}
                        </td>
                      </tr>
                    ) : (
                      linkedInvoices.map((invoice) => {
                        const totals = invoiceTotals(invoice);
                        const paid = paidCentsFor(invoice.id, payments);
                        const remaining = Math.max(0, totals.htCents - paid);
                        return (
                          <tr className="border-t border-[#edf2f8]" key={invoice.id}>
                            <td className="px-3 py-2 font-semibold tabular-nums text-[#24334c]">
                              {invoiceDisplayNumber(invoice)}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-[#516078]">
                              {invoice.issueDate}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-[#516078]">
                              {invoice.dueDate}
                            </td>
                            <td className="px-3 py-2 capitalize text-[#516078]">
                              {invoice.status}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-[#516078]">
                              {formatMoneyFromCents(totals.htCents)}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-[#516078]">
                              {formatMoneyFromCents(paid)}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-[#516078]">
                              {formatMoneyFromCents(remaining)}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                className="action-motion text-[11px] font-semibold text-[#044ce2]"
                                type="button"
                                onClick={() => onOpenInvoice(invoice.id)}
                              >
                                {t("detail.viewInvoice")}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[#98a4b5]">{t("detail.invoiceImmutable")}</p>
            </div>
          ) : null}

          {tab === "costs" ? (
            <div className="overflow-x-auto rounded-[12px] border border-[#edf2f8]" style={{ animation: "compte-tab-in 160ms ease-out" }}>
              <table className="w-full min-w-[800px] border-collapse text-left text-[11px]">
                <thead className="bg-[#f8fafc] text-[#7d8aa0]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t("expense.date")}</th>
                    <th className="px-3 py-2 font-semibold">{t("expense.supplier")}</th>
                    <th className="px-3 py-2 font-semibold">{t("expense.category")}</th>
                    <th className="px-3 py-2 font-semibold">{t("expense.amount")}</th>
                    <th className="px-3 py-2 font-semibold">{t("expense.vat")}</th>
                    <th className="px-3 py-2 font-semibold">{t("expense.submittedBy")}</th>
                    <th className="px-3 py-2 font-semibold">{t("columns.status")}</th>
                    <th className="px-3 py-2 font-semibold">{t("expense.receipt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedExpenses.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-[#98a4b5]" colSpan={8}>
                        {t("detail.noCosts")}
                      </td>
                    </tr>
                  ) : (
                    linkedExpenses.map((expense) => (
                      <tr className="border-t border-[#edf2f8]" key={expense.id}>
                        <td className="px-3 py-2 tabular-nums text-[#516078]">
                          {expense.date}
                        </td>
                        <td className="px-3 py-2 text-[#24334c]">{expense.supplier}</td>
                        <td className="px-3 py-2 text-[#516078]">
                          {t(`expense.categories.${expense.category}`)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-[#516078]">
                          {canViewFinance
                            ? formatMoneyFromCents(expense.amountCents)
                            : t("finance.masked")}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-[#516078]">
                          {canViewFinance
                            ? formatMoneyFromCents(expense.vatCents)
                            : t("finance.masked")}
                        </td>
                        <td className="px-3 py-2 text-[#516078]">{expense.submittedBy}</td>
                        <td className="px-3 py-2">
                          <StatusBadge size="xs" tone={expenseStatusTone[expense.status]}>
                            {t(`expense.status.${expense.status}`)}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2 text-[#516078]">
                          {expense.receiptName ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === "activity" ? (
            <ul className="space-y-2" style={{ animation: "compte-tab-in 160ms ease-out" }}>
              {projectActivities.length === 0 ? (
                <li className="rounded-[12px] border border-[#edf2f8] px-3 py-6 text-center text-[11px] text-[#98a4b5]">
                  {t("detail.noActivity")}
                </li>
              ) : (
                projectActivities.map((item) => (
                  <li
                    className="rounded-[12px] border border-[#edf2f8] px-3 py-2.5"
                    key={item.id}
                  >
                    <div className="flex items-start gap-2">
                      {item.type.includes("invoice") ? (
                        <ReceiptText className="mt-0.5 h-3.5 w-3.5 text-[#7d8aa0]" />
                      ) : (
                        <FileText className="mt-0.5 h-3.5 w-3.5 text-[#7d8aa0]" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-[#24334c]">
                          {t(item.titleKey)}
                        </p>
                        {item.bodyKey ? (
                          <p className="mt-0.5 text-[11px] text-[#516078]">
                            {item.type === "status_changed" &&
                            typeof item.bodyParams?.status === "string"
                              ? t(item.bodyKey, {
                                  status: t(
                                    `status.${item.bodyParams.status as ProjectStatus}`,
                                  ),
                                })
                              : t(item.bodyKey, item.bodyParams ?? {})}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-[#98a4b5]">
                          {item.actor} · {item.at.slice(0, 10)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </div>
    </FormSheet>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold text-[#98a4b5]">{label}</dt>
      <dd className="mt-0.5 text-xs tabular-nums text-[#405069]">{value}</dd>
    </div>
  );
}

function FinanceCell({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[10px] px-2.5 py-2",
        muted ? "bg-[#f8fafc]" : "border border-[#edf2f8]",
      )}
    >
      <p className="text-[10px] font-semibold text-[#98a4b5]">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-[#24334c]">
        {value}
      </p>
    </div>
  );
}
