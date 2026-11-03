"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";
import { FormSheet } from "@/components/forms/form-sheet";
import { cn } from "@/lib/utils";

import type {
  IntegrationActivity,
  IntegrationConnection,
  IntegrationDefinition,
  IntegrationDisplayStatus,
} from "../model";
import { IntegrationActivityPanel } from "./details/integration-activity";
import {
  IntegrationApiKeysPanel,
  IntegrationMegPanel,
  IntegrationWebhooksPanel,
} from "./details/integration-developer-panels";
import { IntegrationOverview } from "./details/integration-overview";

type DetailTab = "overview" | "activity" | "api_keys" | "endpoints" | "imports";

function tabsFor(
  definition: IntegrationDefinition,
  status: IntegrationDisplayStatus,
): DetailTab[] {
  if (definition.slug === "rest-api") return ["overview", "api_keys"];
  if (definition.slug === "webhooks") return ["overview", "endpoints"];
  if (definition.slug === "meg-import") return ["overview", "imports"];
  if (
    (status === "connected" || status === "attention") &&
    (definition.category === "banking" ||
      definition.category === "payments" ||
      definition.category === "accounting")
  ) {
    return ["overview", "activity"];
  }
  return ["overview"];
}

export function IntegrationDetails({
  open,
  definition,
  connection,
  status,
  activities,
  scopeLabel,
  canManage,
  syncing,
  onClose,
  onConnect,
  onDisconnect,
  onSync,
  onManageApi,
  onStartImport,
}: {
  open: boolean;
  definition: IntegrationDefinition;
  connection: IntegrationConnection | null;
  status: IntegrationDisplayStatus;
  activities: IntegrationActivity[];
  scopeLabel: string;
  canManage: boolean;
  syncing?: boolean;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  onManageApi?: () => void;
  onStartImport?: () => void;
}) {
  const t = useTranslations("integrations");
  const tabs = useMemo(() => tabsFor(definition, status), [definition, status]);
  const [tab, setTab] = useState<DetailTab>(tabs[0] ?? "overview");
  const activeTab = tabs.includes(tab) ? tab : (tabs[0] ?? "overview");

  const canSync =
    Boolean(connection) &&
    (status === "connected" || status === "attention") &&
    (definition.category === "banking" || definition.category === "payments");

  const showReadyAction = canManage && status === "ready";
  const showConnectedActions =
    canManage &&
    (status === "connected" || status === "attention") &&
    definition.slug !== "meg-import";

  const footer =
    showReadyAction || showConnectedActions ? (
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
          type="button"
          onClick={onClose}
        >
          {t("connect.cancel")}
        </button>
        {showReadyAction ? (
          <button
            className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
            type="button"
            onClick={
              definition.slug === "meg-import" && onStartImport
                ? onStartImport
                : definition.slug === "rest-api" && onManageApi
                  ? onManageApi
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
        {showConnectedActions ? (
          <>
            {definition.slug === "rest-api" && onManageApi ? (
              <button
                className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
                type="button"
                onClick={onManageApi}
              >
                {t("actions.manageApi")}
              </button>
            ) : null}
            {canSync ? (
              <button
                className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069] disabled:opacity-60"
                disabled={syncing}
                type="button"
                onClick={onSync}
              >
                {syncing ? t("actions.syncing") : t("actions.syncNow")}
              </button>
            ) : null}
            <button
              className="min-h-10 rounded-[10px] border border-[#f0cfc8] bg-[#fff7f5] px-3 text-sm font-semibold text-[#b54841] hover:bg-[#ffefeb]"
              type="button"
              onClick={onDisconnect}
            >
              {t("actions.disconnect")}
            </button>
          </>
        ) : null}
      </div>
    ) : undefined;

  return (
    <FormSheet
      closeLabel={t("detail.close")}
      description={t(`categories.${definition.category}`)}
      footer={footer}
      open={open}
      title={t(definition.nameKey)}
      widthClassName="sm:max-w-[460px]"
      onClose={onClose}
    >
      <div className="space-y-4 p-1">
        {tabs.length > 1 ? (
          <AnimatedSelectionGroup
            className="-mx-1"
            id={`integration-detail-tabs-${definition.id}`}
          >
            <div
              aria-label={t("detail.tabsLabel")}
              className="flex min-w-0 gap-1 overflow-x-auto"
              role="tablist"
            >
              {tabs.map((item) => {
                const active = activeTab === item;
                return (
                  <button
                    aria-selected={active}
                    className={cn(
                      "relative h-10 shrink-0 rounded-full px-3 text-[12px] font-semibold transition-colors",
                      active
                        ? "text-[#145be7]"
                        : "text-[#7d8aa0] hover:text-[#405069]",
                    )}
                    key={item}
                    role="tab"
                    type="button"
                    onClick={() => setTab(item)}
                  >
                    {active ? (
                      <AnimatedActiveIndicator
                        className="rounded-full"
                        layoutId={`integration-detail-tab-${definition.id}`}
                        variant="soft-pill"
                      />
                    ) : null}
                    <span className="relative z-[1]">
                      {t(`detail.tabs.${item}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </AnimatedSelectionGroup>
        ) : null}

        {activeTab === "overview" ? (
          <IntegrationOverview
            canManage={false}
            canSync={false}
            connection={connection}
            definition={definition}
            scopeLabel={scopeLabel}
            status={status}
          />
        ) : null}
        {activeTab === "activity" ? (
          <IntegrationActivityPanel items={activities} />
        ) : null}
        {activeTab === "api_keys" ? <IntegrationApiKeysPanel /> : null}
        {activeTab === "endpoints" ? <IntegrationWebhooksPanel /> : null}
        {activeTab === "imports" ? <IntegrationMegPanel /> : null}
      </div>
    </FormSheet>
  );
}
