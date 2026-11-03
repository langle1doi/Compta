"use client";

import { useSyncExternalStore } from "react";

export type ReminderStage =
  | "BEFORE_DUE_3_DAYS"
  | "OVERDUE_7_DAYS"
  | "OVERDUE_15_DAYS"
  | "OVERDUE_30_DAYS"
  | "MANUAL";

export type ReminderChannel = "email";

export type ReminderEvent = {
  id: string;
  invoiceId: string;
  sentAt: string;
  channel: ReminderChannel;
  stage: ReminderStage;
  recipient: string;
  actor: string;
  subject: string;
};

type ReminderState = {
  events: ReminderEvent[];
};

const serverState: ReminderState = { events: [] };
let state: ReminderState = structuredClone(serverState);
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

function getServerSnapshot() {
  return serverState;
}

export function useReminderEvents() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).events;
}

export function remindersForInvoice(events: ReminderEvent[], invoiceId: string) {
  return events
    .filter((item) => item.invoiceId === invoiceId)
    .sort((left, right) => right.sentAt.localeCompare(left.sentAt));
}

export function sendReminder(input: {
  invoiceId: string;
  recipient: string;
  subject: string;
  stage?: ReminderStage;
  actor?: string;
}) {
  const event: ReminderEvent = {
    id: crypto.randomUUID(),
    invoiceId: input.invoiceId,
    sentAt: new Date().toISOString(),
    channel: "email",
    stage: input.stage ?? "MANUAL",
    recipient: input.recipient,
    actor: input.actor ?? "You",
    subject: input.subject,
  };
  state = { events: [event, ...state.events] };
  emit();
  return { ok: true as const, event };
}

export function daysOverdue(dueDate: string, today: string) {
  if (dueDate >= today) return 0;
  const due = Date.parse(`${dueDate}T00:00:00`);
  const now = Date.parse(`${today}T00:00:00`);
  if (!Number.isFinite(due) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.round((now - due) / 86_400_000));
}

export function reminderRecipient(customerId: string) {
  return `accounting@${customerId}.fr`;
}

/** Future automation stages — documented for later scheduler work. */
export const FUTURE_REMINDER_SCHEDULE = [
  "BEFORE_DUE_3_DAYS",
  "OVERDUE_7_DAYS",
  "OVERDUE_15_DAYS",
  "OVERDUE_30_DAYS",
] as const satisfies ReminderStage[];
