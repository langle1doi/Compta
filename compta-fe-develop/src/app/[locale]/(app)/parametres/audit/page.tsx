import { getTranslations } from "next-intl/server";

import { SettingsShell } from "@/features/settings/components/settings-shell";

export default async function AuditPlaceholderPage() {
  const t = await getTranslations("usersPermissions");

  return (
    <SettingsShell description={t("audit.placeholderBody")} title={t("audit.placeholderTitle")}>
      <section className="dashboard-card dashboard-enter p-5">
        <p className="max-w-[60ch] text-sm leading-6 text-[#66758d]">{t("audit.placeholderHint")}</p>
      </section>
    </SettingsShell>
  );
}
