"use client";

import { useSyncExternalStore } from "react";

import type {
  AutomationActivity,
  AutomationDefinition,
  AutomationReviewItem,
  AutomationRun,
  AutomationStatus,
  ExecutionMode,
} from "./model";
import {
  seedActivities,
  seedAutomations,
  seedReviewItems,
  seedRuns,
} from "./seed";

type AutomationState = {
  automations: AutomationDefinition[];
  runs: AutomationRun[];
  reviewItems: AutomationReviewItem[];
  activities: AutomationActivity[];
};

const serverState: AutomationState = {
  automations: seedAutomations,
  runs: seedRuns,
  reviewItems: seedReviewItems,
  activities: seedActivities,
};

let state: AutomationState = structuredClone(serverState);
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

export function useAutomationState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useAutomations() {
  return useAutomationState().automations;
}

export function useAutomationRuns() {
  return useAutomationState().runs;
}

export function useAutomationReviewItems() {
  return useAutomationState().reviewItems;
}

export function useAutomationActivities() {
  return useAutomationState().activities;
}

function patchAutomation(
  id: string,
  patch: Partial<AutomationDefinition>,
) {
  state = {
    ...state,
    automations: state.automations.map((item) =>
      item.id === id
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item,
    ),
  };
  emit();
}

export function setAutomationStatus(id: string, status: AutomationStatus) {
  patchAutomation(id, { status });
}

export function pauseAutomation(id: string) {
  patchAutomation(id, { status: "paused", nextRunAt: null });
  pushActivity({
    automationId: id,
    titleKey: "activity.paused.title",
    bodyKey: "activity.paused.body",
    actor: "You",
    result: "skipped",
  });
}

export function resumeAutomation(id: string) {
  const automation = state.automations.find((item) => item.id === id);
  if (!automation) return;
  const nextRunAt = nextMorningIso(automation.scheduleCronLabel);
  patchAutomation(id, { status: "active", nextRunAt });
  pushActivity({
    automationId: id,
    titleKey: "activity.resumed.title",
    bodyKey: "activity.resumed.body",
    actor: "You",
    result: "success",
  });
}

export function setAutomationExecutionMode(id: string, executionMode: ExecutionMode) {
  const current = state.automations.find((item) => item.id === id);
  if (!current) return;
  const nextConfig =
    current.type === "payment_reminders" || current.type === "quote_follow_up"
      ? {
          ...current.configuration,
          mode: executionMode === "automatic" ? "automatic" : "suggest_approve",
        }
      : current.configuration;
  patchAutomation(id, { executionMode, configuration: nextConfig });
  pushActivity({
    automationId: id,
    titleKey: "activity.modeChanged.title",
    bodyKey: "activity.modeChanged.body",
    actor: "You",
    result: "success",
  });
}

export function updateAutomationConfiguration(
  id: string,
  configuration: Record<string, unknown>,
) {
  const current = state.automations.find((item) => item.id === id);
  if (!current) return;
  const time =
    typeof configuration.time === "string"
      ? configuration.time
      : current.scheduleCronLabel;
  patchAutomation(id, {
    configuration,
    scheduleCronLabel: time,
    nextRunAt:
      current.status === "active" ? nextMorningIso(time) : current.nextRunAt,
  });
}

export function resolveReviewItem(id: string) {
  state = {
    ...state,
    reviewItems: state.reviewItems.map((item) =>
      item.id === id ? { ...item, status: "resolved" } : item,
    ),
  };
  emit();
}

export function activateAutomationFromTemplate(input: {
  type: AutomationDefinition["type"];
  executionMode: ExecutionMode;
  configuration: Record<string, unknown>;
  displayName?: string;
  scheduleTime?: string;
}) {
  const templates: Record<
    AutomationDefinition["type"],
    Pick<
      AutomationDefinition,
      | "nameKey"
      | "descriptionKey"
      | "category"
      | "triggerLabelKey"
      | "triggerHelperKey"
      | "scheduleCronLabel"
      | "lastOutcomeKey"
    >
  > = {
    bank_reconciliation: {
      nameKey: "items.bank.name",
      descriptionKey: "items.bank.description",
      category: "finance",
      triggerLabelKey: "items.bank.trigger",
      triggerHelperKey: "items.bank.triggerHelper",
      scheduleCronLabel: "08:00",
      lastOutcomeKey: "items.bank.outcomeEmpty",
    },
    payment_reminders: {
      nameKey: "items.reminders.name",
      descriptionKey: "items.reminders.description",
      category: "finance",
      triggerLabelKey: "items.reminders.trigger",
      triggerHelperKey: "items.reminders.triggerHelper",
      scheduleCronLabel: "07:30",
      lastOutcomeKey: "items.reminders.outcomeEmpty",
    },
    quote_follow_up: {
      nameKey: "items.quotes.name",
      descriptionKey: "items.quotes.description",
      category: "sales",
      triggerLabelKey: "items.quotes.trigger",
      triggerHelperKey: "items.quotes.triggerHelper",
      scheduleCronLabel: "10:00",
      lastOutcomeKey: "items.quotes.outcomeEmpty",
    },
  };

  // Always create a new automation instance from the wizard.
  // Do not upsert by type — seed templates already exist and users expect a new list row.
  const scheduleTime = input.scheduleTime ?? templates[input.type].scheduleCronLabel;
  const meta = templates[input.type];
  const id = `auto-${input.type}-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const created: AutomationDefinition = {
    id,
    ...meta,
    type: input.type,
    status: "active",
    executionMode: input.executionMode,
    companyId: "co-dfm-europe",
    companyName: "DFM-Europe",
    scheduleCronLabel: scheduleTime,
    lastRunAt: null,
    nextRunAt: nextMorningIso(scheduleTime),
    configuration: {
      ...input.configuration,
      name: input.displayName ?? input.configuration.name,
    },
    createdAt: now,
    updatedAt: now,
  };
  state = { ...state, automations: [created, ...state.automations] };
  emit();
  pushActivity({
    automationId: id,
    titleKey: "activity.created.title",
    bodyKey: "activity.created.body",
    actor: "You",
    result: "success",
  });
  return id;
}

function pushActivity(
  input: Omit<AutomationActivity, "id" | "at"> & { at?: string },
) {
  const activity: AutomationActivity = {
    id: crypto.randomUUID(),
    at: input.at ?? new Date().toISOString(),
    automationId: input.automationId,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    bodyParams: input.bodyParams,
    entityLabel: input.entityLabel,
    actor: input.actor,
    result: input.result,
  };
  state = { ...state, activities: [activity, ...state.activities] };
  emit();
}

function nextMorningIso(timeLabel: string) {
  const [hours, minutes] = timeLabel.split(":").map((part) => Number(part));
  const next = new Date("2026-10-03T00:00:00.000Z");
  next.setUTCHours(Number.isFinite(hours) ? hours : 8, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next.toISOString();
}
