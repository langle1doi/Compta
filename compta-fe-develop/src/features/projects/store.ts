"use client";

import { useSyncExternalStore } from "react";

import type {
  ExpenseCategory,
  ExpenseStatus,
  Project,
  ProjectActivity,
  ProjectExpense,
  ProjectStatus,
} from "./model";
import {
  seedExpenses,
  seedProjectActivities,
  seedProjects,
} from "./seed";

type State = {
  projects: Project[];
  expenses: ProjectExpense[];
  activities: ProjectActivity[];
};

let state: State = {
  projects: seedProjects,
  expenses: seedExpenses,
  activities: seedProjectActivities,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useProjectsState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function pushActivity(
  input: Omit<ProjectActivity, "id" | "at"> & { at?: string },
) {
  const activity: ProjectActivity = {
    id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: input.at ?? new Date().toISOString(),
    projectId: input.projectId,
    type: input.type,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    bodyParams: input.bodyParams,
    actor: input.actor,
  };
  state = { ...state, activities: [activity, ...state.activities] };
}

export function createProject(input: {
  name: string;
  customerId: string;
  customerName: string;
  companyId: string;
  description?: string;
  code?: string;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  const seq = String(state.projects.length + 1).padStart(3, "0");
  const project: Project = {
    id: `prj-${Date.now()}`,
    code: input.code?.trim() || `PRJ-${year}-${seq}`,
    name: input.name.trim(),
    customerId: input.customerId,
    customerName: input.customerName,
    companyId: input.companyId,
    description: input.description?.trim() ?? "",
    status: input.status ?? "active",
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    quoteIds: [],
    invoiceIds: [],
    createdAt: now,
    updatedAt: now,
  };
  state = { ...state, projects: [project, ...state.projects] };
  pushActivity({
    projectId: project.id,
    type: "created",
    titleKey: "activity.created",
    actor: "Current user",
  });
  emit();
  return project;
}

export function linkQuoteToProject(projectId: string, quoteId: string) {
  state = {
    ...state,
    projects: state.projects.map((project) => {
      if (project.id !== projectId || project.quoteIds.includes(quoteId)) {
        return project;
      }
      return {
        ...project,
        quoteIds: [...project.quoteIds, quoteId],
        updatedAt: new Date().toISOString(),
      };
    }),
  };
  pushActivity({
    projectId,
    type: "quote_linked",
    titleKey: "activity.quoteLinked",
    bodyKey: "activity.quoteLinkedBody",
    bodyParams: { quote: quoteId },
    actor: "Current user",
  });
  emit();
}

export function linkInvoiceToProject(projectId: string, invoiceId: string, label: string) {
  state = {
    ...state,
    projects: state.projects.map((project) => {
      if (project.id !== projectId || project.invoiceIds.includes(invoiceId)) {
        return project;
      }
      return {
        ...project,
        invoiceIds: [...project.invoiceIds, invoiceId],
        updatedAt: new Date().toISOString(),
      };
    }),
  };
  pushActivity({
    projectId,
    type: "invoice_linked",
    titleKey: "activity.invoiceLinked",
    bodyKey: "activity.invoiceLinkedBody",
    bodyParams: { invoice: label },
    actor: "Current user",
  });
  emit();
}

export function createExpense(input: {
  projectId: string | null;
  companyId: string;
  submittedBy: string;
  date: string;
  supplier: string;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  vatCents: number;
  receiptName: string | null;
  ocrApplied: boolean;
  status: ExpenseStatus;
}) {
  const now = new Date().toISOString();
  const expense: ProjectExpense = {
    id: `exp-${Date.now()}`,
    currency: "EUR",
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  state = { ...state, expenses: [expense, ...state.expenses] };
  if (expense.projectId && expense.status === "pending_approval") {
    pushActivity({
      projectId: expense.projectId,
      type: "expense_submitted",
      titleKey: "activity.expenseSubmitted",
      bodyKey: "activity.expenseSubmittedBody",
      bodyParams: { amount: formatEuroLabel(expense.amountCents) },
      actor: expense.submittedBy,
    });
  }
  emit();
  return expense;
}

export function approveExpense(expenseId: string, actor: string) {
  const now = new Date().toISOString();
  let projectId: string | null = null;
  let amountCents = 0;
  state = {
    ...state,
    expenses: state.expenses.map((expense) => {
      if (expense.id !== expenseId) return expense;
      projectId = expense.projectId;
      amountCents = expense.amountCents;
      return {
        ...expense,
        status: "approved" as const,
        approvedBy: actor,
        approvedAt: now,
        rejectionReason: null,
        updatedAt: now,
      };
    }),
  };
  if (projectId) {
    pushActivity({
      projectId,
      type: "expense_approved",
      titleKey: "activity.expenseApproved",
      bodyKey: "activity.expenseApprovedBody",
      bodyParams: { amount: formatEuroLabel(amountCents), actor },
      actor,
    });
  }
  emit();
}

export function setProjectStatus(projectId: string, status: ProjectStatus) {
  const current = state.projects.find((project) => project.id === projectId);
  if (!current || current.status === status) return;

  const now = new Date().toISOString();
  state = {
    ...state,
    projects: state.projects.map((project) => {
      if (project.id !== projectId) return project;
      return { ...project, status, updatedAt: now };
    }),
  };
  pushActivity({
    projectId,
    type: "status_changed",
    titleKey: "activity.statusChanged",
    bodyKey: "activity.statusChangedBody",
    bodyParams: { status },
    actor: "Current user",
  });
  emit();
}

export function archiveProject(projectId: string) {
  setProjectStatus(projectId, "archived");
}

export function rejectExpense(expenseId: string, actor: string, reason: string) {
  const now = new Date().toISOString();
  let projectId: string | null = null;
  state = {
    ...state,
    expenses: state.expenses.map((expense) => {
      if (expense.id !== expenseId) return expense;
      projectId = expense.projectId;
      return {
        ...expense,
        status: "rejected" as const,
        approvedBy: actor,
        approvedAt: now,
        rejectionReason: reason.trim(),
        updatedAt: now,
      };
    }),
  };
  if (projectId) {
    pushActivity({
      projectId,
      type: "expense_rejected",
      titleKey: "activity.expenseRejected",
      bodyKey: "activity.expenseRejectedBody",
      bodyParams: { reason: reason.trim() },
      actor,
    });
  }
  emit();
}

function formatEuroLabel(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
