import type { Tone } from "@/mocks/dashboard/types";

import type { IntegrationDisplayStatus } from "./model";

export function statusTone(status: IntegrationDisplayStatus): Tone {
  switch (status) {
    case "connected":
      return "green";
    case "ready":
      return "blue";
    case "attention":
      return "orange";
    case "coming_soon":
      return "slate";
  }
}

export function statusLabelKey(status: IntegrationDisplayStatus) {
  return `status.${status}` as const;
}

export function authLabelKeyForDefinition(authType: string) {
  switch (authType) {
    case "oauth":
      return "auth.oauth";
    case "api_key":
      return "auth.apiKey";
    case "credentials":
      return "auth.smtp";
    default:
      return "auth.internal";
  }
}
