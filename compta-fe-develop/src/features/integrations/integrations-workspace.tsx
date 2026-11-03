"use client";

import { PlugZap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { SoftToast } from "@/components/compte/soft-toast";
import { can } from "@/features/settings/can";
import { useCurrentCompany } from "@/features/settings/company-store";
import { usePermissions } from "@/features/settings/session-provider";

import { INTEGRATION_CATALOG } from "./catalog";
import { ConnectIntegrationSheet } from "./components/connection/connect-integration-sheet";
import { DisconnectIntegrationDialog } from "./components/connection/disconnect-integration-dialog";
import { IntegrationCard } from "./components/integration-card";
import { IntegrationCategories } from "./components/integration-categories";
import { IntegrationDetails } from "./components/integration-details";
import { IntegrationFilters } from "./components/integration-filters";
import { IntegrationKpis } from "./components/integration-kpis";
import type {
  IntegrationDefinition,
  IntegrationFilters as Filters,
} from "./model";
import { authLabelKeyForDefinition } from "./status";
import {
  connectIntegration,
  disconnectIntegration,
  requestManualSync,
  useIntegrationsState,
} from "./store";
import {
  catalogKpis,
  categoryCounts,
  connectionForDefinition,
  filterCatalog,
  resolveDisplayStatus,
} from "./utils";

const emptyFilters: Filters = {
  search: "",
  category: "all",
  sort: "recommended",
};

function primaryActionLabel(
  definition: IntegrationDefinition,
  status: ReturnType<typeof resolveDisplayStatus>,
  t: (key: string) => string,
) {
  if (status === "coming_soon") return t("actions.comingSoon");
  if (definition.slug === "meg-import") return t("actions.startImport");
  if (status === "connected" || status === "attention") {
    if (definition.slug === "rest-api") return t("actions.manageApi");
    if (definition.slug === "webhooks") return t("actions.manage");
    return t("actions.manage");
  }
  if (definition.slug === "rest-api") return t("actions.manageApi");
  return t("actions.connect");
}

export function IntegrationsWorkspace() {
  const t = useTranslations("integrations");
  const { companyId, company } = useCurrentCompany();
  const { connections, activities } = useIntegrationsState();

  const activePermissions = usePermissions();
  const canRead = can(activePermissions, "integration.read");
  const canManageBase = can(activePermissions, "integration.manage");
  const canManageBank = can(activePermissions, "bank.manage");

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectId, setConnectId] = useState<string | null>(null);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">(
    "info",
  );

  const kpis = useMemo(
    () => catalogKpis(connections, companyId),
    [companyId, connections],
  );
  const counts = useMemo(
    () => categoryCounts(connections, companyId),
    [companyId, connections],
  );

  const filtered = useMemo(() => {
    const base = filterCatalog(filters, connections, companyId);
    const query = filters.search.trim().toLowerCase();
    if (!query) return base;
    return base.filter((item) => {
      const name = t(item.nameKey).toLowerCase();
      const description = t(item.descriptionKey).toLowerCase();
      return (
        name.includes(query) ||
        description.includes(query) ||
        item.slug.includes(query) ||
        item.category.includes(query)
      );
    });
  }, [companyId, connections, filters, t]);

  const selected =
    INTEGRATION_CATALOG.find((item) => item.id === selectedId) ?? null;
  const selectedConnection = selected
    ? connectionForDefinition(selected, connections, companyId)
    : null;
  const selectedStatus = selected
    ? resolveDisplayStatus(selected, selectedConnection)
    : null;
  const selectedActivities = selectedConnection
    ? activities
        .filter((item) => item.connectionId === selectedConnection.id)
        .sort((a, b) => b.at.localeCompare(a.at))
    : [];

  const connectDefinition =
    INTEGRATION_CATALOG.find((item) => item.id === connectId) ?? null;
  const disconnectDefinition =
    INTEGRATION_CATALOG.find((item) => item.id === disconnectId) ?? null;
  const disconnectConnection = disconnectDefinition
    ? connectionForDefinition(disconnectDefinition, connections, companyId)
    : null;

  function canManageDefinition(definition: IntegrationDefinition) {
    if (!canManageBase) return false;
    if (definition.category === "banking") return canManageBank;
    return true;
  }

  function scopeLabel(definition: IntegrationDefinition) {
    if (definition.scope === "tenant") return t("scope.tenant");
    return company?.name ?? companyId;
  }

  function selectIntegration(id: string) {
    setSelectedId(id);
  }

  function closeDetails() {
    setSelectedId(null);
  }

  function openConnect(definition: IntegrationDefinition) {
    if (definition.availability === "coming_soon") return;
    if (definition.slug === "meg-import") {
      setSelectedId(definition.id);
      setNotice(t("toast.importReady"));
      setNoticeTone("info");
      return;
    }
    if (definition.slug === "rest-api" || definition.slug === "webhooks") {
      setSelectedId(definition.id);
      return;
    }
    setSelectedId(null);
    setConnectId(definition.id);
  }

  function handlePrimary(definition: IntegrationDefinition) {
    const connection = connectionForDefinition(
      definition,
      connections,
      companyId,
    );
    const status = resolveDisplayStatus(definition, connection);
    if (status === "coming_soon") return;
    if (status === "connected" || status === "attention") {
      selectIntegration(definition.id);
      return;
    }
    openConnect(definition);
  }

  function confirmConnect() {
    if (!connectDefinition) return;
    connectIntegration({
      integrationId: connectDefinition.id,
      companyId:
        connectDefinition.scope === "company" ? companyId : undefined,
      authLabelKey: authLabelKeyForDefinition(connectDefinition.authType),
    });
    setConnectId(null);
    setSelectedId(connectDefinition.id);
    setNotice(t("toast.connected", { name: t(connectDefinition.nameKey) }));
    setNoticeTone("success");
  }

  function confirmDisconnect() {
    if (!disconnectConnection || !disconnectDefinition) return;
    disconnectIntegration(disconnectConnection.id);
    setDisconnectId(null);
    setNotice(
      t("toast.disconnected", { name: t(disconnectDefinition.nameKey) }),
    );
    setNoticeTone("info");
  }

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    requestManualSync(connectionId);
    setSyncingId(null);
    setNotice(t("toast.syncRequested"));
    setNoticeTone("info");
  }

  if (!canRead) {
    return (
      <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-6">
        <p className="text-sm text-[#7d8aa0]">{t("forbidden")}</p>
      </main>
    );
  }

  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="dashboard-scroll integrations-page dashboard-stack flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto pb-8">
        <header className="dashboard-enter enter-0 shrink-0">
          <p className="max-w-2xl text-[14px] leading-[1.5] text-[#7d8aa0]">
            {t("subtitle")}
          </p>
          {kpis.connected === 0 ? (
            <div className="mt-3 flex items-start gap-3 rounded-[14px] border border-[#dce6f3] bg-[rgba(255,255,255,.82)] px-4 py-3">
              <PlugZap
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-[#145be7]"
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#24334c]">
                  {t("empty.connectedTitle")}
                </p>
                <p className="mt-0.5 text-[12px] text-[#7d8aa0]">
                  {t("empty.connectedBody")}
                </p>
              </div>
            </div>
          ) : null}
        </header>

        <div className="dashboard-enter enter-1 shrink-0">
          <IntegrationKpis kpis={kpis} />
        </div>

        <div className="dashboard-enter enter-2 flex shrink-0 flex-col gap-3 xl:flex-row xl:items-end xl:gap-4">
          <IntegrationCategories
            active={filters.category}
            counts={counts}
            onChange={(category) =>
              setFilters((current) => ({ ...current, category }))
            }
          />
          <IntegrationFilters
            search={filters.search}
            sort={filters.sort}
            onSearchChange={(search) =>
              setFilters((current) => ({ ...current, search }))
            }
            onSortChange={(sort) =>
              setFilters((current) => ({ ...current, sort }))
            }
          />
        </div>

        <section className="dashboard-enter enter-3 grid min-w-0 grid-cols-1 gap-5 pb-2">
          <div className="min-w-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-[#dce6f3] bg-white/60 px-6 py-16 text-center">
                <p className="text-sm font-semibold text-[#24334c]">
                  {t("empty.searchTitle")}
                </p>
                <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">
                  {t("empty.searchBody")}
                </p>
                <button
                  className="action-motion soft-primary mt-2 inline-flex h-9 items-center rounded-[10px] px-3 text-xs font-semibold text-white"
                  type="button"
                  onClick={() => setFilters(emptyFilters)}
                >
                  {t("empty.clearFilters")}
                </button>
              </div>
            ) : (
              <div className="integration-grid grid grid-cols-1 gap-3.5 sm:grid-cols-2 2xl:grid-cols-3">
                {filtered.map((definition) => {
                  const connection = connectionForDefinition(
                    definition,
                    connections,
                    companyId,
                  );
                  const status = resolveDisplayStatus(definition, connection);
                  return (
                    <IntegrationCard
                      canManage={canManageDefinition(definition)}
                      definition={definition}
                      key={definition.id}
                      primaryLabel={primaryActionLabel(definition, status, t)}
                      selected={selectedId === definition.id}
                      status={status}
                      onPrimary={() => handlePrimary(definition)}
                      onSelect={() => selectIntegration(definition.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {selected && selectedStatus ? (
        <IntegrationDetails
          key={selected.id}
          activities={selectedActivities}
          canManage={canManageDefinition(selected)}
          connection={selectedConnection}
          definition={selected}
          open={Boolean(selected)}
          scopeLabel={scopeLabel(selected)}
          status={selectedStatus}
          syncing={
            selectedConnection
              ? syncingId === selectedConnection.id
              : false
          }
          onClose={closeDetails}
          onConnect={() => openConnect(selected)}
          onDisconnect={() => setDisconnectId(selected.id)}
          onManageApi={() => {
            setNotice(t("toast.manageApi"));
            setNoticeTone("info");
          }}
          onStartImport={() => {
            setNotice(t("toast.importReady"));
            setNoticeTone("info");
          }}
          onSync={() => {
            if (selectedConnection) void handleSync(selectedConnection.id);
          }}
        />
      ) : null}

      <ConnectIntegrationSheet
        companyName={company?.name ?? companyId}
        definition={connectDefinition}
        open={Boolean(connectDefinition)}
        onClose={() => setConnectId(null)}
        onContinue={confirmConnect}
      />

      <DisconnectIntegrationDialog
        open={Boolean(disconnectDefinition && disconnectConnection)}
        providerName={
          disconnectDefinition ? t(disconnectDefinition.nameKey) : ""
        }
        scopeLabel={
          disconnectDefinition ? scopeLabel(disconnectDefinition) : ""
        }
        onCancel={() => setDisconnectId(null)}
        onConfirm={confirmDisconnect}
      />

      <SoftToast
        message={notice}
        tone={noticeTone}
        onDismiss={() => setNotice("")}
      />
    </main>
  );
}
