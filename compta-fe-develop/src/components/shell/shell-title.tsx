"use client";

import { useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";

export function ShellTitle() {
  const pathname = usePathname();
  const t = useTranslations();

  if (pathname.startsWith("/customers")) return <>{t("customers.title")}</>;
  if (pathname.startsWith("/devis")) return <>{t("register.title")}</>;
  if (pathname.startsWith("/factures")) return <>{t("invoices.workspaceTitle")}</>;
  if (pathname.startsWith("/paiements")) return <>{t("payments.title")}</>;
  if (pathname.startsWith("/produits")) return <>{t("products.title")}</>;
  if (pathname.startsWith("/rapports")) return <>{t("reports.title")}</>;
  if (pathname.startsWith("/automation")) return <>{t("automation.title")}</>;
  if (pathname.startsWith("/projects")) return <>{t("projects.title")}</>;
  if (pathname.startsWith("/templates")) return <>{t("templates.title")}</>;
  if (pathname.startsWith("/integrations")) return <>{t("integrations.title")}</>;
  if (pathname.startsWith("/parametres")) return <>{t("settings.title")}</>;
  if (pathname.startsWith("/activite")) return <>{t("activity.title")}</>;
  return <>{t("header.title")}</>;
}
