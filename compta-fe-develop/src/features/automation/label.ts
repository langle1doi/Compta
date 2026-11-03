import type { AutomationDefinition } from "./model";

/** Prefer wizard/custom name; fall back to template i18n key. */
export function automationLabel(
  automation: Pick<AutomationDefinition, "nameKey" | "configuration">,
  translate: (key: string) => string,
) {
  const custom = automation.configuration.name;
  if (typeof custom === "string" && custom.trim()) {
    return custom.trim();
  }
  return translate(automation.nameKey);
}
