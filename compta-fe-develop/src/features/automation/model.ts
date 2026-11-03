export type AutomationType =
  | "bank_reconciliation"
  | "payment_reminders"
  | "quote_follow_up";

export type AutomationCategory = "finance" | "sales";

export type AutomationStatus = "active" | "paused" | "error" | "draft";

export type AutomationRunStatus =
  | "success"
  | "needs_review"
  | "failed"
  | "skipped"
  | "running";

export type ExecutionMode = "automatic" | "suggest_approve" | "auto_with_review";

export type ReviewItemType =
  | "bank_match"
  | "reminder_draft"
  | "quote_follow_up_draft";

export type ReviewItemStatus = "open" | "resolved" | "dismissed";

export type AutomationDefinition = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  type: AutomationType;
  category: AutomationCategory;
  status: AutomationStatus;
  executionMode: ExecutionMode;
  companyId: string;
  companyName: string;
  triggerLabelKey: string;
  triggerHelperKey: string;
  scheduleCronLabel: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastOutcomeKey: string;
  lastOutcomeParams?: Record<string, number | string>;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRunActivityType =
  | "system"
  | "business"
  | "review"
  | "approval"
  | "notification"
  | "email"
  | "payment"
  | "invoice"
  | "quote"
  | "skip"
  | "error";

export type AutomationRunActivityStatus =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "skip";

export type AutomationRunActivityAction =
  | "bank_review"
  | "reminder_review"
  | "quote_review";

export type AutomationRunActivity = {
  id: string;
  runId: string;
  /** Display time within the run (HH:mm:ss). */
  at: string;
  type: AutomationRunActivityType;
  status: AutomationRunActivityStatus;
  titleKey: string;
  titleParams?: Record<string, number | string>;
  descriptionKey?: string;
  descriptionParams?: Record<string, number | string>;
  entityLabel?: string;
  actor?: string;
  meta?: { labelKey: string; value: string }[];
  action?: {
    kind: AutomationRunActivityAction;
    labelKey: string;
    count?: number;
  };
};

export type AutomationRun = {
  id: string;
  automationId: string;
  startedAt: string;
  finishedAt: string | null;
  trigger: string;
  status: AutomationRunStatus;
  processed: number;
  succeeded: number;
  skipped: number;
  needsReview: number;
  failed: number;
  durationMs: number | null;
  summaryKey: string;
  summaryParams?: Record<string, number | string>;
  errorSummaryKey?: string;
  activities: AutomationRunActivity[];
};

export type AutomationReviewItem = {
  id: string;
  automationId: string;
  type: ReviewItemType;
  titleKey: string;
  titleParams?: Record<string, number | string>;
  reasonKey: string;
  entityType: "bank_transaction" | "invoice" | "quote";
  entityId: string;
  entityLabel: string;
  createdAt: string;
  status: ReviewItemStatus;
};

export type AutomationActivity = {
  id: string;
  automationId: string;
  at: string;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, number | string>;
  entityLabel?: string;
  actor: string;
  result: "success" | "needs_review" | "skipped" | "failed" | "approved";
};

export type AutomationKpis = {
  activeCount: number;
  configuredCount: number;
  actionsThisMonth: number;
  needsAttention: number;
  successRate: number | null;
};

export type WorkflowStep = {
  id: string;
  titleKey: string;
  bodyKey: string;
  tone?: "default" | "decision" | "stop" | "action";
};

export const AUTOMATION_WORKFLOWS: Record<AutomationType, WorkflowStep[]> = {
  bank_reconciliation: [
    {
      id: "trigger",
      titleKey: "workflow.bank.triggerTitle",
      bodyKey: "workflow.bank.triggerBody",
    },
    {
      id: "match",
      titleKey: "workflow.bank.matchTitle",
      bodyKey: "workflow.bank.matchBody",
    },
    {
      id: "decision",
      titleKey: "workflow.bank.decisionTitle",
      bodyKey: "workflow.bank.decisionBody",
      tone: "decision",
    },
    {
      id: "payment",
      titleKey: "workflow.bank.paymentTitle",
      bodyKey: "workflow.bank.paymentBody",
      tone: "action",
    },
    {
      id: "invoice",
      titleKey: "workflow.bank.invoiceTitle",
      bodyKey: "workflow.bank.invoiceBody",
      tone: "action",
    },
    {
      id: "review",
      titleKey: "workflow.bank.reviewTitle",
      bodyKey: "workflow.bank.reviewBody",
      tone: "decision",
    },
  ],
  payment_reminders: [
    {
      id: "trigger",
      titleKey: "workflow.reminders.triggerTitle",
      bodyKey: "workflow.reminders.triggerBody",
    },
    {
      id: "schedule",
      titleKey: "workflow.reminders.scheduleTitle",
      bodyKey: "workflow.reminders.scheduleBody",
    },
    {
      id: "check",
      titleKey: "workflow.reminders.checkTitle",
      bodyKey: "workflow.reminders.checkBody",
      tone: "stop",
    },
    {
      id: "prepare",
      titleKey: "workflow.reminders.prepareTitle",
      bodyKey: "workflow.reminders.prepareBody",
    },
    {
      id: "mode",
      titleKey: "workflow.reminders.modeTitle",
      bodyKey: "workflow.reminders.modeBody",
      tone: "decision",
    },
    {
      id: "log",
      titleKey: "workflow.reminders.logTitle",
      bodyKey: "workflow.reminders.logBody",
    },
  ],
  quote_follow_up: [
    {
      id: "status",
      titleKey: "workflow.quotes.statusTitle",
      bodyKey: "workflow.quotes.statusBody",
    },
    {
      id: "trigger",
      titleKey: "workflow.quotes.triggerTitle",
      bodyKey: "workflow.quotes.triggerBody",
    },
    {
      id: "prepare",
      titleKey: "workflow.quotes.prepareTitle",
      bodyKey: "workflow.quotes.prepareBody",
    },
    {
      id: "mode",
      titleKey: "workflow.quotes.modeTitle",
      bodyKey: "workflow.quotes.modeBody",
      tone: "decision",
    },
    {
      id: "action",
      titleKey: "workflow.quotes.actionTitle",
      bodyKey: "workflow.quotes.actionBody",
      tone: "action",
    },
    {
      id: "log",
      titleKey: "workflow.quotes.logTitle",
      bodyKey: "workflow.quotes.logBody",
    },
  ],
};
