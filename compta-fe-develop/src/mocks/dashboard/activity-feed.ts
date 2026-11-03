import type { ActivityActor, ActivityEntityType, ActivityKind, ActivityStatus } from "@/features/activity/model";

export type ActivityTitleKey =
  | "feed.quoteAccepted"
  | "feed.reminderSuggested"
  | "feed.reconciliationConfirmed"
  | "feed.reminderSent"
  | "feed.paymentReceived"
  | "feed.quoteWaiting"
  | "feed.quoteCreated";

export type ActivityMetaKey =
  | "feed.metaAmount"
  | "feed.metaOverdue"
  | "feed.metaMatched"
  | "feed.metaInvoice"
  | "feed.metaAutoMatch"
  | "feed.metaValidSep"
  | "feed.metaValidOct";

export type ActivityEventSource = {
  id: string;
  kind: ActivityKind;
  titleKey: ActivityTitleKey;
  entityType: ActivityEntityType;
  entityId: string;
  amountCents?: number;
  status: ActivityStatus;
  actor?: ActivityActor;
  timestamp: string;
  metaKey: ActivityMetaKey;
  metaValues?: Record<string, string | number>;
  href?: string;
};

export type AttentionTitleKey = "feed.attentionOverdue" | "feed.attentionApprove" | "feed.attentionReconcile";

export type AttentionMetaKey =
  | "feed.attentionOverdueMeta"
  | "feed.attentionApproveMeta"
  | "feed.attentionReconcileMeta";

export type AttentionSource = {
  id: string;
  kind: "invoice" | "quote" | "reconciliation";
  titleKey: AttentionTitleKey;
  amountCents?: number;
  urgency?: "high" | "medium";
  metaKey: AttentionMetaKey;
  metaValues?: Record<string, string | number>;
  href?: string;
  entityType: ActivityEntityType;
  entityId: string;
};

export const activityEvents: ActivityEventSource[] = [
  {
    id: "act-accepted-148",
    kind: "quote",
    titleKey: "feed.quoteAccepted",
    entityType: "quote",
    entityId: "DEV20260148",
    amountCents: 1_245_000,
    status: "accepted",
    actor: { name: "Jean Dupont", initials: "JD" },
    timestamp: "2026-10-02T10:42:00",
    metaKey: "feed.metaAmount",
    href: "/devis?quote=DEV20260148",
  },
  {
    id: "act-suggestion-126",
    kind: "system",
    titleKey: "feed.reminderSuggested",
    entityType: "invoice",
    entityId: "FAC20260126",
    amountCents: 624_000,
    status: "suggestion",
    timestamp: "2026-10-02T09:28:00",
    metaKey: "feed.metaOverdue",
  },
  {
    id: "act-reconciled-428",
    kind: "payment",
    titleKey: "feed.reconciliationConfirmed",
    entityType: "reconciliation",
    entityId: "BNK20261002",
    amountCents: 428_000,
    status: "reconciled",
    actor: { name: "Marie Dupont", initials: "MD" },
    timestamp: "2026-10-02T08:15:00",
    metaKey: "feed.metaMatched",
    metaValues: { count: 2 },
  },
  {
    id: "act-sent-102",
    kind: "invoice",
    titleKey: "feed.reminderSent",
    entityType: "invoice",
    entityId: "FAC20260102",
    amountCents: 624_000,
    status: "sent",
    timestamp: "2026-10-01T16:40:00",
    metaKey: "feed.metaInvoice",
  },
  {
    id: "act-paid-102",
    kind: "payment",
    titleKey: "feed.paymentReceived",
    entityType: "invoice",
    entityId: "FAC20260102",
    amountCents: 624_000,
    status: "paid",
    timestamp: "2026-10-01T14:21:00",
    metaKey: "feed.metaAutoMatch",
  },
  {
    id: "act-approve-150",
    kind: "quote",
    titleKey: "feed.quoteWaiting",
    entityType: "quote",
    entityId: "DEV20260150",
    amountCents: 843_000,
    status: "toApprove",
    timestamp: "2026-10-01T11:03:00",
    metaKey: "feed.metaValidSep",
    href: "/devis?quote=DEV20260150",
  },
  {
    id: "act-draft-151",
    kind: "quote",
    titleKey: "feed.quoteCreated",
    entityType: "quote",
    entityId: "DEV20260151",
    amountCents: 312_000,
    status: "draft",
    timestamp: "2026-10-01T09:17:00",
    metaKey: "feed.metaValidOct",
    href: "/devis?quote=DEV20260151",
  },
];

export const attentionFeed: AttentionSource[] = [
  {
    id: "attn-overdue-126",
    kind: "invoice",
    titleKey: "feed.attentionOverdue",
    amountCents: 624_000,
    urgency: "high",
    metaKey: "feed.attentionOverdueMeta",
    entityType: "invoice",
    entityId: "FAC20260126",
  },
  {
    id: "attn-approve-150",
    kind: "quote",
    titleKey: "feed.attentionApprove",
    amountCents: 843_000,
    urgency: "medium",
    metaKey: "feed.attentionApproveMeta",
    href: "/devis?quote=DEV20260150",
    entityType: "quote",
    entityId: "DEV20260150",
  },
  {
    id: "attn-reconcile-428",
    kind: "reconciliation",
    titleKey: "feed.attentionReconcile",
    amountCents: 428_000,
    urgency: "medium",
    metaKey: "feed.attentionReconcileMeta",
    metaValues: { count: 2 },
    entityType: "reconciliation",
    entityId: "BNK20261002",
  },
];

export const activityTip = {
  id: "tip-reminders",
} as const;
