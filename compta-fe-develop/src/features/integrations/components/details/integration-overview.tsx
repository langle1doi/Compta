"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { IntegrationLogo } from "../../logo-registry";
import type {
  IntegrationConnection,
  IntegrationDefinition,
  IntegrationDisplayStatus,
} from "../../model";
import { IntegrationStatusBadge } from "../integration-status-badge";

function formatWhen(iso: string | undefined, locale: string) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function IntegrationOverview({
  definition,
  connection,
  status,
  scopeLabel,
  canManage = false,
  canSync = false,
  syncing,
  onConnect,
  onDisconnect,
  onSync,
  onManageApi,
  onStartImport,
}: {
  definition: IntegrationDefinition;
  connection: IntegrationConnection | null;
  status: IntegrationDisplayStatus;
  scopeLabel: string;
  canManage?: boolean;
  canSync?: boolean;
  syncing?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSync?: () => void;
  onManageApi?: () => void;
  onStartImport?: () => void;
}) {
  const t = useTranslations("integrations");
  const locale = useLocale();
  const lastSync = formatWhen(connection?.lastSyncAt, locale);
  const connectedAt = formatWhen(connection?.connectedAt, locale);
  const authLabel = connection
    ? t(connection.authLabelKey)
    : t(
        definition.authType === "oauth"
          ? "auth.oauth"
          : definition.authType === "api_key"
            ? "auth.apiKey"
            : definition.authType === "credentials"
              ? "auth.smtp"
              : "auth.internal",
      );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-[14px] border border-[#e4ecf6] bg-[#f8fbff] p-3.5">
        <IntegrationLogo logoKey={definition.logoKey} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[#173156]">
            {t(definition.nameKey)}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[#7d8aa0]">
            {t(`categories.${definition.category}`)}
          </p>
        </div>
        <IntegrationStatusBadge status={status} />
      </div>

      <dl className="space-y-3 text-[13px]">
        <StackField label={t("detail.scope")}>{scopeLabel}</StackField>

        <StackField label={t("detail.authentication")}>{authLabel}</StackField>

        <StackField label={t("detail.capabilities")}>
          <ul className="list-disc space-y-1 pl-4 font-normal text-[#405069]">
            {definition.capabilities.map((capability) => (
              <li key={capability}>{t(`capabilities.${capability}`)}</li>
            ))}
          </ul>
        </StackField>

        <StackField label={t("detail.about")}>
          <p className="font-normal leading-6 text-[#516078]">
            {t(definition.descriptionKey)}
          </p>
        </StackField>

        <StackField label={t("detail.connectionStatus")}>
          <IntegrationStatusBadge status={status} />
        </StackField>

        {status === "connected" || status === "attention" ? (
          <>
            <StackField label={t("detail.connectedAt")}>
              {connectedAt ?? t("detail.neverSynced")}
            </StackField>
            {definition.slug !== "meg-import" &&
            definition.category !== "developer" &&
            definition.category !== "email" ? (
              <StackField label={t("detail.lastSync")}>
                {lastSync ?? t("detail.neverSynced")}
              </StackField>
            ) : null}
          </>
        ) : null}
      </dl>

      {definition.slug === "meg-import" ? (
        <p className="rounded-[12px] bg-[#f3f6fb] px-3 py-2 text-[12px] leading-5 text-[#66758d]">
          {t("detail.megNote")}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {status === "ready" && onConnect ? (
            <button
              className="action-motion soft-primary inline-flex h-9 items-center rounded-[10px] px-3.5 text-[12px] font-semibold text-white"
              type="button"
              onClick={
                definition.slug === "meg-import" && onStartImport
                  ? onStartImport
                  : onConnect
              }
            >
              {definition.slug === "meg-import"
                ? t("actions.startImport")
                : definition.slug === "rest-api"
                  ? t("actions.manageApi")
                  : t("actions.connect")}
            </button>
          ) : null}
          {(status === "connected" || status === "attention") &&
          definition.slug !== "meg-import" ? (
            <>
              {definition.slug === "rest-api" && onManageApi ? (
                <button
                  className="inline-flex h-9 items-center rounded-[10px] border border-[#d5e2f4] bg-white px-3.5 text-[12px] font-semibold text-[#405069] hover:bg-[#f7faff]"
                  type="button"
                  onClick={onManageApi}
                >
                  {t("actions.manageApi")}
                </button>
              ) : null}
              {canSync && onSync ? (
                <button
                  className="inline-flex h-9 items-center rounded-[10px] border border-[#d5e2f4] bg-white px-3.5 text-[12px] font-semibold text-[#405069] hover:bg-[#f7faff] disabled:opacity-60"
                  disabled={syncing}
                  type="button"
                  onClick={onSync}
                >
                  {syncing ? t("actions.syncing") : t("actions.syncNow")}
                </button>
              ) : null}
              {onDisconnect ? (
                <button
                  className="inline-flex h-9 items-center rounded-[10px] border border-[#f0cfc8] bg-[#fff7f5] px-3.5 text-[12px] font-semibold text-[#b54841] hover:bg-[#ffefeb]"
                  type="button"
                  onClick={onDisconnect}
                >
                  {t("actions.disconnect")}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StackField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[#7d8aa0]">{label}</dt>
      <dd className="mt-0.5 font-medium text-[#24334c]">{children}</dd>
    </div>
  );
}
