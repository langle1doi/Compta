import type { Tone } from "@/mocks/dashboard/types";

import type {
  AutomationRunStatus,
  AutomationStatus,
  ExecutionMode,
} from "./model";

export const automationStatusTone: Record<AutomationStatus, Tone> = {
  active: "green",
  paused: "slate",
  error: "red",
  draft: "orange",
};

export const runStatusTone: Record<AutomationRunStatus, Tone> = {
  success: "green",
  needs_review: "orange",
  failed: "red",
  skipped: "slate",
  running: "blue",
};

export function executionModeLabelKey(mode: ExecutionMode) {
  switch (mode) {
    case "automatic":
      return "mode.automatic";
    case "suggest_approve":
      return "mode.suggestApprove";
    case "auto_with_review":
      return "mode.autoWithReview";
  }
}
