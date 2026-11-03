import type {
  AutomationRun,
  AutomationRunActivity,
  AutomationRunActivityStatus,
  AutomationRunActivityType,
} from "./model";

type LegacyLogLine = {
  at: string;
  messageKey: string;
  params?: Record<string, number | string>;
};

export type SeedRunInput = Omit<AutomationRun, "activities"> & {
  logLines: LegacyLogLine[];
};

function activity(
  runId: string,
  partial: Omit<AutomationRunActivity, "id" | "runId"> & { id?: string },
): AutomationRunActivity {
  return {
    id: partial.id ?? `${runId}-${partial.at}-${partial.titleKey}`,
    runId,
    ...partial,
  };
}

function fromLogLine(
  runId: string,
  line: LegacyLogLine,
  index: number,
): AutomationRunActivity | null {
  const count = Number(line.params?.count ?? 0);
  const base = { at: line.at, id: `${runId}-log-${index}` };

  switch (line.messageKey) {
    case "runs.bank.log.fetched":
      return activity(runId, {
        ...base,
        type: "system",
        status: "success",
        titleKey: "runActivity.bank.fetchedTitle",
        descriptionKey: "runActivity.bank.fetchedBody",
        descriptionParams: { count },
      });
    case "runs.bank.log.matched":
      return activity(runId, {
        ...base,
        type: "business",
        status: "success",
        titleKey: "runActivity.bank.matchedTitle",
        descriptionKey: "runActivity.bank.matchedBody",
        descriptionParams: { count },
      });
    case "runs.bank.log.review":
      return activity(runId, {
        ...base,
        type: "review",
        status: "warning",
        titleKey: "runActivity.bank.reviewTitle",
        descriptionKey: "runActivity.bank.reviewBody",
        descriptionParams: { count },
        action: {
          kind: "bank_review",
          labelKey: "runActivity.actions.reviewBank",
          count,
        },
      });
    case "runs.bank.log.syncStart":
      return activity(runId, {
        ...base,
        type: "system",
        status: "info",
        titleKey: "runActivity.bank.syncStartTitle",
        descriptionKey: "runActivity.bank.syncStartBody",
      });
    case "runs.bank.log.syncFail":
      return activity(runId, {
        ...base,
        type: "error",
        status: "error",
        titleKey: "runActivity.bank.syncFailTitle",
        descriptionKey: "runActivity.bank.syncFailBody",
      });
    case "runs.reminders.log.checked":
      return activity(runId, {
        ...base,
        type: "system",
        status: "success",
        titleKey: "runActivity.reminders.checkedTitle",
        descriptionKey: "runActivity.reminders.checkedBody",
        descriptionParams: { count },
      });
    case "runs.reminders.log.drafts":
      return activity(runId, {
        ...base,
        type: "business",
        status: "success",
        titleKey: "runActivity.reminders.draftsTitle",
        descriptionKey: "runActivity.reminders.draftsBody",
        descriptionParams: { count },
      });
    case "runs.reminders.log.skipped":
      return activity(runId, {
        ...base,
        type: "skip",
        status: "skip",
        titleKey: "runActivity.reminders.skippedTitle",
        descriptionKey: "runActivity.reminders.skippedBody",
        descriptionParams: { count },
      });
    case "runs.quotes.log.checked":
      return activity(runId, {
        ...base,
        type: "system",
        status: "success",
        titleKey: "runActivity.quotes.checkedTitle",
        descriptionKey: "runActivity.quotes.checkedBody",
        descriptionParams: { count },
      });
    case "runs.quotes.log.suggestions":
      return activity(runId, {
        ...base,
        type: "quote",
        status: "success",
        titleKey: "runActivity.quotes.candidatesTitle",
        descriptionKey: "runActivity.quotes.candidatesBody",
        descriptionParams: { count },
      });
    case "runs.quotes.log.sent":
      return activity(runId, {
        ...base,
        type: "email",
        status: "success",
        titleKey: "runActivity.quotes.sentTitle",
        descriptionKey: "runActivity.quotes.sentBody",
        descriptionParams: { count },
      });
    default:
      return null;
  }
}

/** Post-run business events linked back to the originating execution. */
function postRunExtras(run: SeedRunInput): AutomationRunActivity[] {
  if (run.id === "run-bank-20261002") {
    return [
      activity(run.id, {
        id: `${run.id}-match-confirmed`,
        at: "09:21:32",
        type: "approval",
        status: "success",
        titleKey: "runActivity.bank.matchConfirmedTitle",
        descriptionKey: "runActivity.bank.matchConfirmedBody",
        entityLabel: "FAC20260021 · Delta Services",
        actor: "Marie Dupont",
        meta: [
          { labelKey: "runActivity.meta.amount", value: "3 250,00 €" },
        ],
      }),
      activity(run.id, {
        id: `${run.id}-payment-linked`,
        at: "09:21:33",
        type: "payment",
        status: "success",
        titleKey: "runActivity.bank.paymentLinkedTitle",
        descriptionKey: "runActivity.bank.paymentLinkedBody",
        entityLabel: "FAC20260021",
      }),
      activity(run.id, {
        id: `${run.id}-invoice-updated`,
        at: "09:21:33",
        type: "invoice",
        status: "success",
        titleKey: "runActivity.bank.invoiceUpdatedTitle",
        descriptionKey: "runActivity.bank.invoiceUpdatedBody",
        entityLabel: "FAC20260021 · Delta Services",
        meta: [
          { labelKey: "runActivity.meta.status", value: "Partial" },
          { labelKey: "runActivity.meta.remaining", value: "8 960,00 €" },
        ],
      }),
    ];
  }

  if (run.id === "run-reminders-20261002") {
    return [
      activity(run.id, {
        id: `${run.id}-approval-required`,
        at: "07:32:24",
        type: "review",
        status: "warning",
        titleKey: "runActivity.reminders.approvalTitle",
        descriptionKey: "runActivity.reminders.approvalBody",
        descriptionParams: { count: run.needsReview },
        action: {
          kind: "reminder_review",
          labelKey: "runActivity.actions.reviewDrafts",
          count: run.needsReview,
        },
      }),
    ];
  }

  if (run.id === "run-quotes-20261001") {
    return [
      activity(run.id, {
        id: `${run.id}-drafts`,
        at: "10:05:22",
        type: "business",
        status: "success",
        titleKey: "runActivity.quotes.draftsTitle",
        descriptionKey: "runActivity.quotes.draftsBody",
        descriptionParams: { count: 7 },
      }),
      activity(run.id, {
        id: `${run.id}-approved`,
        at: "10:12:44",
        type: "approval",
        status: "success",
        titleKey: "runActivity.quotes.approvedTitle",
        descriptionKey: "runActivity.quotes.approvedBody",
        entityLabel: "DEV20260147 · Maison Lumière",
        actor: "Jean Martin",
      }),
      activity(run.id, {
        id: `${run.id}-sent-detail`,
        at: "10:12:46",
        type: "email",
        status: "success",
        titleKey: "runActivity.quotes.followUpSentTitle",
        descriptionKey: "runActivity.quotes.followUpSentBody",
        entityLabel: "Maison Lumière",
        meta: [
          {
            labelKey: "runActivity.meta.to",
            value: "customer@maison-lumiere.fr",
          },
        ],
      }),
    ];
  }

  if (
    run.automationId === "auto-payment-reminders" &&
    run.status === "needs_review" &&
    run.id !== "run-reminders-20261002"
  ) {
    return [
      activity(run.id, {
        id: `${run.id}-approval-required`,
        at: run.logLines.at(-1)?.at ?? "07:30:50",
        type: "review",
        status: "warning",
        titleKey: "runActivity.reminders.approvalTitle",
        descriptionKey: "runActivity.reminders.approvalBody",
        descriptionParams: { count: run.needsReview },
        action: {
          kind: "reminder_review",
          labelKey: "runActivity.actions.reviewDrafts",
          count: run.needsReview,
        },
      }),
    ];
  }

  if (run.id === "run-bank-20261001") {
    return [
      activity(run.id, {
        id: `${run.id}-payment-linked`,
        at: "08:01:25",
        type: "payment",
        status: "success",
        titleKey: "runActivity.bank.paymentsLinkedTitle",
        descriptionKey: "runActivity.bank.paymentsLinkedBody",
        descriptionParams: { count: 38 },
      }),
      activity(run.id, {
        id: `${run.id}-invoices-updated`,
        at: "08:01:28",
        type: "invoice",
        status: "success",
        titleKey: "runActivity.bank.invoicesUpdatedTitle",
        descriptionKey: "runActivity.bank.invoicesUpdatedBody",
        descriptionParams: { count: 38 },
      }),
    ];
  }

  return [];
}

/** Convert seed log lines + post-run events into run-scoped activities. */
export function buildSeedRunActivities(run: SeedRunInput): AutomationRunActivity[] {
  const fromLogs = run.logLines
    .map((line, index) => fromLogLine(run.id, line, index))
    .filter((item): item is AutomationRunActivity => item !== null);

  const merged = [...fromLogs, ...postRunExtras(run)];
  return merged.sort((a, b) => a.at.localeCompare(b.at));
}

export function finalizeSeedRuns(inputs: SeedRunInput[]): AutomationRun[] {
  return inputs.map(({ logLines, ...rest }) => ({
    ...rest,
    activities: buildSeedRunActivities({ ...rest, logLines }),
  }));
}

export function activitiesForRun(
  run: AutomationRun | null | undefined,
): AutomationRunActivity[] {
  if (!run) return [];
  return [...run.activities]
    .filter((item) => item.runId === run.id)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function activityTone(
  status: AutomationRunActivityStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "success") return "success";
  if (status === "warning") return "warning";
  if (status === "error") return "danger";
  if (status === "skip") return "neutral";
  return "info";
}

export function activityIconType(
  type: AutomationRunActivityType,
  status: AutomationRunActivityStatus,
): AutomationRunActivityType | "error" {
  if (status === "error" || type === "error") return "error";
  return type;
}
