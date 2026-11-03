"use client";

import { useSyncExternalStore } from "react";

import type { IntegrationActivity, IntegrationConnection } from "./model";
import { TENANT_ID } from "./model";
import { seedActivities, seedConnections } from "./seed";

type IntegrationsState = {
  connections: IntegrationConnection[];
  activities: IntegrationActivity[];
};

const serverState: IntegrationsState = {
  connections: seedConnections,
  activities: seedActivities,
};

let state: IntegrationsState = structuredClone(serverState);
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

export function useIntegrationsState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function pushActivity(
  partial: Omit<IntegrationActivity, "id" | "at"> & { at?: string },
) {
  const activity: IntegrationActivity = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: partial.at ?? new Date().toISOString(),
    connectionId: partial.connectionId,
    tone: partial.tone,
    titleKey: partial.titleKey,
    bodyKey: partial.bodyKey,
    bodyParams: partial.bodyParams,
  };
  state = {
    ...state,
    activities: [activity, ...state.activities],
  };
}

export function connectIntegration(input: {
  integrationId: string;
  companyId?: string;
  authLabelKey: string;
}) {
  const existing = state.connections.find((item) => {
    if (item.integrationId !== input.integrationId) return false;
    if (input.companyId) return item.companyId === input.companyId;
    return !item.companyId;
  });

  const now = new Date().toISOString();

  if (existing) {
    state = {
      ...state,
      connections: state.connections.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              status: "connected",
              connectedAt: item.connectedAt ?? now,
              authLabelKey: input.authLabelKey,
            }
          : item,
      ),
    };
    pushActivity({
      connectionId: existing.id,
      tone: "success",
      titleKey: "activity.connected",
    });
    emit();
    return existing.id;
  }

  const id = `conn-${input.integrationId}-${Date.now()}`;
  const connection: IntegrationConnection = {
    id,
    integrationId: input.integrationId,
    tenantId: TENANT_ID,
    companyId: input.companyId,
    status: "connected",
    connectedAt: now,
    authLabelKey: input.authLabelKey,
  };
  state = {
    ...state,
    connections: [connection, ...state.connections],
  };
  pushActivity({
    connectionId: id,
    tone: "success",
    titleKey: "activity.connected",
  });
  emit();
  return id;
}

export function disconnectIntegration(connectionId: string) {
  state = {
    ...state,
    connections: state.connections.map((item) =>
      item.id === connectionId
        ? {
            ...item,
            status: "disconnected",
            lastSyncAt: item.lastSyncAt,
            lastSyncStatus: item.lastSyncStatus,
          }
        : item,
    ),
  };
  pushActivity({
    connectionId,
    tone: "warning",
    titleKey: "activity.disconnected",
  });
  emit();
}

/** Records a sync request only — does not invent a completed sync. */
export function requestManualSync(connectionId: string) {
  pushActivity({
    connectionId,
    tone: "info",
    titleKey: "activity.syncRequested",
  });
  emit();
}

export function activitiesForConnection(connectionId: string) {
  return state.activities
    .filter((item) => item.connectionId === connectionId)
    .sort((a, b) => b.at.localeCompare(a.at));
}
