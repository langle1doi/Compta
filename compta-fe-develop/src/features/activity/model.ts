export const ACTIVITY_AS_OF = "2026-10-02";

export type ActivityFilter = "all" | "quotes" | "invoices" | "payments" | "system";

export type ActivityKind = "quote" | "invoice" | "payment" | "system";

export type ActivityEntityType = "quote" | "invoice" | "reconciliation";

export type ActivityStatus =
  | "accepted"
  | "suggestion"
  | "reconciled"
  | "sent"
  | "paid"
  | "toApprove"
  | "draft";

export type ActivityActor = {
  name: string;
  initials: string;
};

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  entityType: ActivityEntityType;
  entityId: string;
  amount?: string;
  status: ActivityStatus;
  statusLabel: string;
  actor?: ActivityActor;
  timestamp: string;
  timeLabel: string;
  metadata: string;
  href?: string;
};

export type AttentionKind = "invoice" | "quote" | "reconciliation";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  title: string;
  amount?: string;
  urgency?: "high" | "medium";
  metadata: string;
  href?: string;
  entityType: ActivityEntityType;
  entityId: string;
};

export type ActivityDay = "today" | "yesterday" | "earlier";

export type ActivityGroupModel = {
  day: ActivityDay;
  items: ActivityItem[];
};

const FILTER_KIND: Record<Exclude<ActivityFilter, "all">, ActivityKind> = {
  quotes: "quote",
  invoices: "invoice",
  payments: "payment",
  system: "system",
};

export function activityDay(timestamp: string, asOf = ACTIVITY_AS_OF): ActivityDay {
  const day = timestamp.slice(0, 10);
  if (day === asOf) return "today";
  const [year, month, date] = asOf.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, date - 1)).toISOString().slice(0, 10);
  if (day === previous) return "yesterday";
  return "earlier";
}

export function filterActivity(items: ActivityItem[], filter: ActivityFilter) {
  if (filter === "all") return items;
  const kind = FILTER_KIND[filter];
  return items.filter((item) => item.kind === kind);
}

export function groupActivity(items: ActivityItem[], asOf = ACTIVITY_AS_OF): ActivityGroupModel[] {
  const groups = new Map<ActivityDay, ActivityItem[]>();
  const sorted = [...items].sort((left, right) => (left.timestamp < right.timestamp ? 1 : -1));

  for (const item of sorted) {
    const day = activityDay(item.timestamp, asOf);
    const current = groups.get(day) ?? [];
    current.push(item);
    groups.set(day, current);
  }

  return (["today", "yesterday", "earlier"] as const)
    .filter((day) => groups.has(day))
    .map((day) => ({ day, items: groups.get(day) ?? [] }));
}
