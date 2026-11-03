import type {
  AutomationDefinition,
  AutomationKpis,
  AutomationReviewItem,
  AutomationRun,
} from "./model";

export function getAutomationKpis(
  automations: AutomationDefinition[],
  runs: AutomationRun[],
  reviewItems: AutomationReviewItem[],
  monthPrefix = "2026-10",
): AutomationKpis {
  const activeCount = automations.filter((item) => item.status === "active").length;
  const configuredCount = automations.length;
  const monthRuns = runs.filter((run) => run.startedAt.startsWith(monthPrefix));
  const actionsThisMonth = monthRuns.reduce(
    (sum, run) => sum + run.processed,
    0,
  );
  const needsAttention = reviewItems.filter((item) => item.status === "open").length;
  const completed = monthRuns.filter(
    (run) => run.status !== "running" && run.status !== "skipped",
  );
  const successful = completed.filter(
    (run) => run.status === "success" || run.status === "needs_review",
  );
  const successRate =
    completed.length === 0 ? null : successful.length / completed.length;

  return {
    activeCount,
    configuredCount,
    actionsThisMonth,
    needsAttention,
    successRate,
  };
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
