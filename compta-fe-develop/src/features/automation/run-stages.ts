import {
  AUTOMATION_WORKFLOWS,
  type AutomationRun,
  type AutomationType,
  type WorkflowStep,
} from "./model";

export type RunStageState =
  | "done"
  | "warning"
  | "failed"
  | "skipped"
  | "pending"
  | "running";

export type RunStageNode = {
  id: string;
  titleKey: string;
  bodyKey: string;
  state: RunStageState;
};

function toNode(step: WorkflowStep, state: RunStageState): RunStageNode {
  return {
    id: step.id,
    titleKey: step.titleKey,
    bodyKey: step.bodyKey,
    state,
  };
}

function warningStepId(type: AutomationType) {
  if (type === "bank_reconciliation") return "review";
  return "mode";
}

/** Derive compact pipeline stage states for a historical / live run. */
export function buildRunStageNodes(
  type: AutomationType,
  run: AutomationRun,
): RunStageNode[] {
  const steps = AUTOMATION_WORKFLOWS[type];

  if (run.status === "running") {
    const current = Math.min(Math.max(1, Math.floor(steps.length / 2)), steps.length - 1);
    return steps.map((step, index) =>
      toNode(
        step,
        index < current ? "done" : index === current ? "running" : "pending",
      ),
    );
  }

  if (run.status === "failed") {
    const failAt = type === "bank_reconciliation" ? 0 : 1;
    return steps.map((step, index) =>
      toNode(
        step,
        index < failAt ? "done" : index === failAt ? "failed" : "pending",
      ),
    );
  }

  if (run.status === "skipped") {
    return steps.map((step, index) =>
      toNode(
        step,
        index === 0 ? "done" : index === 1 ? "skipped" : "pending",
      ),
    );
  }

  if (run.status === "needs_review") {
    const warnId = warningStepId(type);
    const warnIndex = Math.max(
      0,
      steps.findIndex((step) => step.id === warnId),
    );
    return steps.map((step, index) => {
      if (index < warnIndex) return toNode(step, "done");
      if (index === warnIndex) return toNode(step, "warning");
      return toNode(step, "pending");
    });
  }

  // success — optionally mark stop/skip nodes when items were skipped
  return steps.map((step) => {
    if (
      type === "payment_reminders" &&
      step.id === "check" &&
      run.skipped > 0 &&
      run.succeeded === 0 &&
      run.needsReview === 0
    ) {
      return toNode(step, "skipped");
    }
    return toNode(step, "done");
  });
}
