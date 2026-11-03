"use client";

import { mockSecuritySettings } from "../mocks/security";
import { SecuritySettingsCard } from "./security-settings-card";
import { SensitiveActionsCard } from "./sensitive-actions-card";
import { SettingsShell } from "./settings-shell";

export function SecurityPage() {
  return (
    <SettingsShell>
      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <SecuritySettingsCard initial={mockSecuritySettings} />
        <SensitiveActionsCard />
      </div>
    </SettingsShell>
  );
}
