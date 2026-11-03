"use client";

import { ChevronRight, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { IconTile } from "@/components/dashboard/tone";
import { Link } from "@/i18n/navigation";

export function SensitiveActionsCard() {
  const t = useTranslations("usersPermissions");

  return (
    <section
      aria-labelledby="sensitive-actions-title"
      className="dashboard-card dashboard-enter flex min-w-0 flex-col p-3.5"
    >
      <div className="flex items-start gap-3">
        <IconTile icon={ShieldAlert} size="sm" tone="orange" />
        <div className="min-w-0">
          <h3 className="dashboard-card-title" id="sensitive-actions-title">
            {t("audit.title")}
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-[#7a899e]">{t("audit.body")}</p>
          <Link
            className="dashboard-link mt-2 inline-flex min-h-8 items-center gap-0.5 text-[13px]"
            href="/parametres/audit"
          >
            {t("audit.cta")}
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
