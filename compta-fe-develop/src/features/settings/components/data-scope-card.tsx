"use client";

import { useTranslations } from "next-intl";

import type { DataScope } from "../types";
import { ScopeBadge } from "./scope-badge";

const scopes: DataScope[] = ["OWN", "COMPANY", "TENANT"];

export function DataScopeCard() {
  const t = useTranslations("usersPermissions");

  return (
    <section
      aria-labelledby="data-scope-title"
      className="dashboard-card dashboard-enter flex min-w-0 flex-col p-3.5"
    >
      <h3 className="dashboard-card-title" id="data-scope-title">
        {t("scope.title")}
      </h3>
      <p className="mt-1 text-[12px] leading-5 text-[#7a899e]">{t("scope.subtitle")}</p>
      <ul className="mt-3 space-y-2">
        {scopes.map((scope) => (
          <li
            className="rounded-[12px] border border-[#e8eef6] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(247,250,253,0.88))] px-3 py-2.5"
            key={scope}
          >
            <div className="flex items-center gap-2">
              <ScopeBadge scope={scope} size="sm" />
            </div>
            <p className="mt-1.5 text-[12px] leading-5 text-[#5f6f88]">{t(`scope.desc.${scope}`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
