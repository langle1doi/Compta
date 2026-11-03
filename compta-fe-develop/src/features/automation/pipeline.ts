import type { AutomationType } from "./model";

export type PipelineBadge =
  | "scheduled"
  | "automatic"
  | "suggest_approve"
  | "needs_review"
  | "system";

export type LivePipelineStep = {
  id: string;
  titleKey: string;
  body: string;
  badge: PipelineBadge;
  tone: "default" | "decision" | "stop" | "action";
};

export type ReminderStageRelative = "before_due" | "after_due";
export type ReminderTone = "gentle" | "standard" | "firm" | "final";

export type ReminderStageConfig = {
  id: "stage1" | "stage2" | "stage3" | "stage4";
  enabled: boolean;
  days: number;
  relative: ReminderStageRelative;
  tone: ReminderTone;
};

export type BankReviewerId = "accounting_team" | "accountant";

export type WizardBankConfig = {
  name: string;
  schedule: "daily";
  time: string;
  timezone: string;
  source: "demo";
  openBankingConnected: false;
  matchInvoiceNumber: true;
  matchAmount: true;
  matchCustomerName: true;
  /** PRD financial path: high-confidence always processes automatically. */
  highConfidence: "automatic";
  uncertain: "review";
  reviewerId: BankReviewerId;
  notifyReviewers: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  autoCloseReview: boolean;
};

export type ReminderTemplateId =
  | "reminder_default"
  | "reminder_firm"
  | "reminder_final";

export type ReminderRecipientId = "billing_contact" | "primary_contact";

export type WizardReminderConfig = {
  name: string;
  stages: ReminderStageConfig[];
  stopWhenPaid: true;
  mode: "suggest_approve" | "automatic";
  templateId: ReminderTemplateId;
  languageMode: "customer" | "en" | "fr";
  recipient: ReminderRecipientId;
  notifyOwnerOnSend: boolean;
  notifyAccountantOnFail: boolean;
};

export type QuoteTemplateId =
  | "quote_follow_up_default"
  | "quote_follow_up_short";

export type WizardQuoteConfig = {
  name: string;
  noResponseEnabled: boolean;
  noResponseDays: number;
  expiryEnabled: boolean;
  daysBeforeExpiry: number;
  mode: "suggest_approve" | "automatic";
  action: "prepare_follow_up" | "notify_salesperson";
  templateId: QuoteTemplateId;
  languageMode: "customer" | "en" | "fr";
  notifyInApp: boolean;
  notifyEmail: boolean;
};

export type WizardConfig =
  | WizardBankConfig
  | WizardReminderConfig
  | WizardQuoteConfig;

export function defaultReminderStages(): ReminderStageConfig[] {
  return [
    {
      id: "stage1",
      enabled: true,
      days: 3,
      relative: "before_due",
      tone: "gentle",
    },
    {
      id: "stage2",
      enabled: true,
      days: 7,
      relative: "after_due",
      tone: "standard",
    },
    {
      id: "stage3",
      enabled: true,
      days: 15,
      relative: "after_due",
      tone: "firm",
    },
    {
      id: "stage4",
      enabled: true,
      days: 30,
      relative: "after_due",
      tone: "final",
    },
  ];
}

export function defaultBankConfig(): WizardBankConfig {
  return {
    name: "Bank payment reconciliation",
    schedule: "daily",
    time: "08:00",
    timezone: "Europe/Paris",
    source: "demo",
    openBankingConnected: false,
    matchInvoiceNumber: true,
    matchAmount: true,
    matchCustomerName: true,
    highConfidence: "automatic",
    uncertain: "review",
    reviewerId: "accounting_team",
    notifyReviewers: true,
    notifyInApp: true,
    notifyEmail: true,
    autoCloseReview: true,
  };
}

export function defaultReminderConfig(): WizardReminderConfig {
  return {
    name: "Payment reminder sequence",
    stages: defaultReminderStages(),
    stopWhenPaid: true,
    mode: "suggest_approve",
    templateId: "reminder_default",
    languageMode: "customer",
    recipient: "billing_contact",
    notifyOwnerOnSend: true,
    notifyAccountantOnFail: true,
  };
}

export function defaultQuoteConfig(): WizardQuoteConfig {
  return {
    name: "Quote follow-up",
    noResponseEnabled: true,
    noResponseDays: 7,
    expiryEnabled: true,
    daysBeforeExpiry: 3,
    mode: "suggest_approve",
    action: "prepare_follow_up",
    templateId: "quote_follow_up_default",
    languageMode: "customer",
    notifyInApp: true,
    notifyEmail: false,
  };
}

function reminderStagesFromRecord(
  configuration: Record<string, unknown>,
): ReminderStageConfig[] {
  const raw = configuration.stages;
  if (Array.isArray(raw) && raw.length === 4) {
    const defaults = defaultReminderStages();
    return defaults.map((stage, index) => {
      const item = raw[index] as Record<string, unknown> | undefined;
      if (!item) return stage;
      return {
        ...stage,
        enabled: item.enabled !== false,
        days: Math.max(0, Number(item.days ?? stage.days) || 0),
        relative:
          item.relative === "before_due" || item.relative === "after_due"
            ? item.relative
            : stage.relative,
        tone:
          item.tone === "gentle" ||
          item.tone === "standard" ||
          item.tone === "firm" ||
          item.tone === "final"
            ? item.tone
            : stage.tone,
      };
    });
  }

  const defaults = defaultReminderStages();
  return [
    { ...defaults[0], enabled: configuration.beforeDue3 !== false },
    { ...defaults[1], enabled: configuration.overdue7 !== false },
    { ...defaults[2], enabled: configuration.overdue15 !== false },
    { ...defaults[3], enabled: configuration.overdue30 !== false },
  ];
}

export function configFromRecord(
  type: AutomationType,
  configuration: Record<string, unknown>,
  fallbackName: string,
): WizardConfig {
  if (type === "bank_reconciliation") {
    const base = defaultBankConfig();
    return {
      ...base,
      name: String(configuration.name ?? fallbackName),
      time: String(configuration.time ?? base.time),
      timezone: String(configuration.timezone ?? base.timezone),
      highConfidence: "automatic",
      reviewerId:
        configuration.reviewerId === "accountant"
          ? "accountant"
          : "accounting_team",
      notifyReviewers: configuration.notifyReviewers !== false,
      notifyInApp: configuration.notifyInApp !== false,
      notifyEmail: configuration.notifyEmail !== false,
      autoCloseReview: configuration.autoCloseReview !== false,
    };
  }
  if (type === "payment_reminders") {
    const base = defaultReminderConfig();
    const templateId =
      configuration.templateId === "reminder_firm" ||
      configuration.templateId === "reminder_final"
        ? configuration.templateId
        : "reminder_default";
    const languageMode =
      configuration.languageMode === "en" || configuration.languageMode === "fr"
        ? configuration.languageMode
        : "customer";
    const recipient =
      configuration.recipient === "primary_contact"
        ? "primary_contact"
        : "billing_contact";
    return {
      ...base,
      name: String(configuration.name ?? fallbackName),
      stages: reminderStagesFromRecord(configuration),
      mode: configuration.mode === "automatic" ? "automatic" : "suggest_approve",
      templateId,
      languageMode,
      recipient,
      notifyOwnerOnSend: configuration.notifyOwnerOnSend !== false,
      notifyAccountantOnFail: configuration.notifyAccountantOnFail !== false,
    };
  }
  const base = defaultQuoteConfig();
  return {
    ...base,
    name: String(configuration.name ?? fallbackName),
    noResponseEnabled: configuration.noResponseEnabled !== false,
    noResponseDays: Number(configuration.noResponseDays ?? base.noResponseDays) || 1,
    expiryEnabled: configuration.expiryEnabled !== false,
    daysBeforeExpiry:
      Number(
        configuration.daysBeforeExpiry ??
          configuration.beforeExpirationDays ??
          base.daysBeforeExpiry,
      ) || 1,
    mode: configuration.mode === "automatic" ? "automatic" : "suggest_approve",
    action:
      configuration.action === "notify_salesperson"
        ? "notify_salesperson"
        : "prepare_follow_up",
    templateId:
      configuration.templateId === "quote_follow_up_short"
        ? "quote_follow_up_short"
        : "quote_follow_up_default",
    languageMode:
      configuration.languageMode === "en" || configuration.languageMode === "fr"
        ? configuration.languageMode
        : "customer",
    notifyInApp: configuration.notifyInApp !== false,
    notifyEmail: configuration.notifyEmail === true,
  };
}

export function toStoredConfiguration(type: AutomationType, config: WizardConfig) {
  if (type === "bank_reconciliation") {
    const bank = config as WizardBankConfig;
    return {
      name: bank.name,
      schedule: "daily" as const,
      time: bank.time,
      timezone: bank.timezone,
      source: bank.source,
      openBankingConnected: false,
      matchInvoiceNumber: true,
      matchAmount: true,
      matchCustomerName: true,
      highConfidence: "automatic",
      uncertain: "review",
      reviewerId: bank.reviewerId,
      notifyReviewers: bank.notifyReviewers,
      notifyInApp: bank.notifyInApp,
      notifyEmail: bank.notifyEmail,
      autoCloseReview: bank.autoCloseReview,
    };
  }
  if (type === "payment_reminders") {
    const reminder = config as WizardReminderConfig;
    const [s1, s2, s3, s4] = reminder.stages;
    return {
      name: reminder.name,
      stages: reminder.stages,
      beforeDue3: s1?.enabled ?? true,
      overdue7: s2?.enabled ?? true,
      overdue15: s3?.enabled ?? true,
      overdue30: s4?.enabled ?? true,
      stopWhenPaid: true,
      mode: reminder.mode,
      templateId: reminder.templateId,
      languageMode: reminder.languageMode,
      recipient: reminder.recipient,
      notifyOwnerOnSend: reminder.notifyOwnerOnSend,
      notifyAccountantOnFail: reminder.notifyAccountantOnFail,
    };
  }
  const quote = config as WizardQuoteConfig;
  return {
    name: quote.name,
    noResponseEnabled: quote.noResponseEnabled,
    noResponseDays: quote.noResponseDays,
    expiryEnabled: quote.expiryEnabled,
    daysBeforeExpiry: quote.daysBeforeExpiry,
    beforeExpirationDays: quote.daysBeforeExpiry,
    mode: quote.mode,
    action: quote.action,
    templateId: quote.templateId,
    languageMode: quote.languageMode,
    notifyInApp: quote.notifyInApp,
    notifyEmail: quote.notifyEmail,
  };
}

function reminderStageLabel(stage: ReminderStageConfig) {
  const sign = stage.relative === "before_due" ? "-" : "+";
  return `${sign}${stage.days}`;
}

function reminderStagesSummary(config: WizardReminderConfig) {
  const active = config.stages.filter((stage) => stage.enabled);
  return active.length
    ? active.map(reminderStageLabel).join(" / ")
    : "none selected";
}

export function buildLivePipeline(
  type: AutomationType,
  config: WizardConfig,
): LivePipelineStep[] {
  if (type === "bank_reconciliation") {
    const bank = config as WizardBankConfig;
    const reviewer =
      bank.reviewerId === "accountant" ? "Accountant" : "Accounting team";
    return [
      {
        id: "trigger",
        titleKey: "pipeline.bank.trigger",
        body: `Daily at ${bank.time} (${bank.timezone}) — demo bank sync (not live Open Banking).`,
        badge: "scheduled",
        tone: "default",
      },
      {
        id: "match",
        titleKey: "pipeline.bank.match",
        body: "Find invoice candidates using invoice number, amount and customer name.",
        badge: "system",
        tone: "default",
      },
      {
        id: "decision",
        titleKey: "pipeline.bank.decision",
        body: "High-confidence → Payment & Invoice update automatically. Uncertain → review.",
        badge: "automatic",
        tone: "decision",
      },
      {
        id: "payment",
        titleKey: "pipeline.bank.payment",
        body: "Create or link the Payment and recalculate already paid / remaining.",
        badge: "automatic",
        tone: "action",
      },
      {
        id: "invoice",
        titleKey: "pipeline.bank.invoice",
        body: "Update invoice collection status to Partial or Paid from remaining balance.",
        badge: "system",
        tone: "action",
      },
      {
        id: "review",
        titleKey: "pipeline.bank.review",
        body: bank.notifyReviewers
          ? `Uncertain matches notify ${reviewer}${bank.notifyInApp ? " in-app" : ""}${bank.notifyEmail ? " by email" : ""}.`
          : `Uncertain matches wait for ${reviewer} without notification.`,
        badge: "needs_review",
        tone: "decision",
      },
    ];
  }

  if (type === "payment_reminders") {
    const reminder = config as WizardReminderConfig;
    const modeBadge =
      reminder.mode === "automatic" ? "automatic" : "suggest_approve";
    return [
      {
        id: "check",
        titleKey: "pipeline.reminders.check",
        body: "Evaluate invoices for the current company against the reminder schedule.",
        badge: "system",
        tone: "default",
      },
      {
        id: "paid",
        titleKey: "pipeline.reminders.stop",
        body: "If the invoice is already Paid, skip and stop. Required system rule.",
        badge: "system",
        tone: "stop",
      },
      {
        id: "schedule",
        titleKey: "pipeline.reminders.schedule",
        body: `Active stages: ${reminderStagesSummary(reminder)} with firmer tone over time.`,
        badge: "scheduled",
        tone: "default",
      },
      {
        id: "prepare",
        titleKey: "pipeline.reminders.prepare",
        body:
          reminder.mode === "automatic"
            ? "Prepare and send the reminder email automatically."
            : "Prepare a reminder draft for approval in Needs Attention.",
        badge: modeBadge,
        tone: "decision",
      },
      {
        id: "send",
        titleKey: "pipeline.reminders.send",
        body:
          reminder.mode === "automatic"
            ? "Send to the customer billing contact by email."
            : "Wait for approval, then send.",
        badge: modeBadge,
        tone: "action",
      },
      {
        id: "log",
        titleKey: "pipeline.reminders.log",
        body: "Log the outcome. Financial balances are never changed by reminders.",
        badge: "system",
        tone: "default",
      },
    ];
  }

  const quote = config as WizardQuoteConfig;
  const modeBadge = quote.mode === "automatic" ? "automatic" : "suggest_approve";
  const triggers: string[] = [];
  if (quote.noResponseEnabled) {
    triggers.push(`no response after ${quote.noResponseDays} days`);
  }
  if (quote.expiryEnabled) {
    triggers.push(`${quote.daysBeforeExpiry} days before expiration`);
  }
  return [
    {
      id: "status",
      titleKey: "pipeline.quotes.status",
      body: "Only Sent quotes are eligible. Accepted, Rejected and Invoiced are ignored.",
      badge: "system",
      tone: "default",
    },
    {
      id: "trigger",
      titleKey: "pipeline.quotes.trigger",
      body: triggers.length ? triggers.join(", or ") + "." : "No trigger enabled.",
      badge: "scheduled",
      tone: "default",
    },
    {
      id: "prepare",
      titleKey: "pipeline.quotes.prepare",
      body:
        quote.action === "notify_salesperson"
          ? "Notify the salesperson / quote owner."
          : "Prepare a customer follow-up from the email template.",
      badge: modeBadge,
      tone: "decision",
    },
    {
      id: "mode",
      titleKey: "pipeline.quotes.mode",
      body:
        quote.mode === "automatic"
          ? "Run the configured action automatically."
          : "Wait for Suggest & approve in Needs Attention.",
      badge: modeBadge,
      tone: "decision",
    },
    {
      id: "action",
      titleKey: "pipeline.quotes.action",
      body:
        quote.action === "notify_salesperson"
          ? "Send the internal notification to the owner."
          : "Send or queue the customer follow-up.",
      badge: modeBadge,
      tone: "action",
    },
    {
      id: "log",
      titleKey: "pipeline.quotes.log",
      body: "Log activity. Quote status does not become Accepted from follow-up alone.",
      badge: "system",
      tone: "default",
    },
  ];
}

export function computeNextRunLabel(time: string, locale: string) {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  const safeHours = Number.isFinite(hours) ? hours : 8;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  const next = new Date(Date.UTC(2026, 9, 3, safeHours, safeMinutes, 0, 0));
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(next);
}

export function validateWizardConfig(
  type: AutomationType,
  config: WizardConfig,
): string | null {
  if (type === "bank_reconciliation") {
    const bank = config as WizardBankConfig;
    if (!bank.name.trim()) return "wizard.errors.name";
    if (!/^\d{2}:\d{2}$/.test(bank.time)) return "wizard.errors.schedule";
    return null;
  }
  if (type === "payment_reminders") {
    const reminder = config as WizardReminderConfig;
    if (!reminder.name.trim()) return "wizard.errors.name";
    const enabled = reminder.stages.filter((stage) => stage.enabled);
    if (enabled.length === 0) return "wizard.errors.reminderStages";
    if (enabled.some((stage) => stage.days < 0 || !Number.isFinite(stage.days))) {
      return "wizard.errors.reminderDays";
    }
    const signatures = enabled.map(
      (stage) => `${stage.relative}:${stage.days}`,
    );
    if (new Set(signatures).size !== signatures.length) {
      return "wizard.errors.reminderDuplicate";
    }
    return null;
  }
  const quote = config as WizardQuoteConfig;
  if (!quote.name.trim()) return "wizard.errors.name";
  if (!quote.noResponseEnabled && !quote.expiryEnabled) {
    return "wizard.errors.trigger";
  }
  if (quote.noResponseEnabled && quote.noResponseDays < 1) {
    return "wizard.errors.trigger";
  }
  if (quote.expiryEnabled && quote.daysBeforeExpiry < 1) {
    return "wizard.errors.trigger";
  }
  return null;
}
