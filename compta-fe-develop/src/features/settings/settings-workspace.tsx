"use client";

import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { LocaleSwitch } from "@/components/locale-switch";

import { SettingsShell } from "./components/settings-shell";

export function SettingsWorkspace() {
  const t = useTranslations("settings");

  return (
    <SettingsShell>
      <section className="dashboard-card dashboard-enter p-5">
        <h3 className="dashboard-card-title">{t("languageTitle")}</h3>
        <p className="mt-1 max-w-[58ch] text-sm leading-6 text-[#66758d]">{t("languageBody")}</p>
        <div className="mt-4">
          <LocaleSwitch />
        </div>
      </section>

      <section className="dashboard-card dashboard-enter mt-3 p-5">
        <h3 className="dashboard-card-title">{t("workspaceTitle")}</h3>
        <div className="mt-4 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-[#e7efff] text-[#044ce2]">
            <Building2 aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#063586]">{t("workspaceName")}</p>
            <p className="mt-0.5 text-xs leading-5 text-[#66758d]">{t("workspaceMeta")}</p>
          </div>
        </div>
        <p className="mt-4 max-w-[58ch] text-sm leading-6 text-[#66758d]">{t("workspaceHint")}</p>
      </section>
    </SettingsShell>
  );
}
