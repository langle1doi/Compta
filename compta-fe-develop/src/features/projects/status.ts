import type { Tone } from "@/mocks/dashboard/types";

import type { ExpenseStatus, ProjectStatus } from "./model";

export const projectStatusTone: Record<ProjectStatus, Tone> = {
  draft: "slate",
  active: "green",
  completed: "blue",
  on_hold: "orange",
  archived: "slate",
};

export const expenseStatusTone: Record<ExpenseStatus, Tone> = {
  draft: "slate",
  submitted: "blue",
  pending_approval: "orange",
  approved: "green",
  rejected: "red",
};
