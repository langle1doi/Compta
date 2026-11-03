"use client";

import dynamic from "next/dynamic";
import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";
import { SoftToast } from "@/components/compte/soft-toast";
import { FormSheet } from "@/components/forms/form-sheet";
import { can } from "@/features/settings/can";
import { usePermissions } from "@/features/settings/session-provider";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { AutomationKpisStrip } from "./components/automation-kpis";
import { AutomationList } from "./components/automation-list";
import { AutomationRecentRuns } from "./components/automation-runs";
import { NeedsAttentionPanel } from "./components/needs-attention";
import { getAutomationKpis } from "./kpis";
import { automationLabel } from "./label";
import type {
  AutomationReviewItem,
  AutomationRunActivityAction,
} from "./model";
import { useAutomationState } from "./store";

const sheetFallback = (
  <div className="flex min-h-[320px] flex-col gap-3 p-4">
    <div className="loading-shimmer h-9 w-2/3 rounded-[10px]" />
    <div className="loading-shimmer h-24 w-full rounded-[12px]" />
    <div className="loading-shimmer min-h-[160px] flex-1 rounded-[12px]" />
  </div>
);

const AutomationDetail = dynamic(
  () =>
    import("./components/automation-detail").then((mod) => mod.AutomationDetail),
  { loading: () => sheetFallback },
);

const NewAutomationSheet = dynamic(
  () =>
    import("./components/new-automation-sheet").then(
      (mod) => mod.NewAutomationSheet,
    ),
  { loading: () => null },
);

const RunDetailSheet = dynamic(
  () =>
    import("./components/run-detail-sheet").then((mod) => mod.RunDetailSheet),
  { loading: () => null },
);

type MainTab = "overview" | "automations";
type ListFilter = "all" | "active" | "inactive" | "needs_attention";

export function AutomationWorkspace() {
  const t = useTranslations("automation");
  const router = useRouter();
  const { automations, runs, reviewItems } = useAutomationState();
  const activePermissions = usePermissions();
  const canRead = can(activePermissions, "automation.read");
  const canManage = can(activePermissions, "automation.manage");
  const canApprove = can(activePermissions, "automation.approve");
  const canReview = canApprove || canManage;

  const [mainTab, setMainTab] = useState<MainTab>("automations");
  const [selectedId, setSelectedId] = useState<string | null>(
    automations[0]?.id ?? null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runReturnToDetail, setRunReturnToDetail] = useState(false);
  const [notice, setNotice] = useState("");

  function openRun(id: string, returnToDetail = false) {
    setRunReturnToDetail(returnToDetail);
    setRunId(id);
  }

  function closeRun() {
    setRunId(null);
    setRunReturnToDetail(false);
  }

  const kpis = useMemo(
    () => getAutomationKpis(automations, runs, reviewItems),
    [automations, reviewItems, runs],
  );

  const attentionAutomationIds = useMemo(() => {
    const ids = new Set(
      reviewItems
        .filter((item) => item.status === "open")
        .map((item) => item.automationId),
    );
    for (const item of automations) {
      if (item.status === "error") ids.add(item.id);
    }
    return ids;
  }, [automations, reviewItems]);

  const listCounts = useMemo(
    () => ({
      all: automations.length,
      active: automations.filter((item) => item.status === "active").length,
      inactive: automations.filter(
        (item) => item.status === "paused" || item.status === "draft",
      ).length,
      needs_attention: attentionAutomationIds.size,
    }),
    [attentionAutomationIds, automations],
  );

  const activeAutomations = useMemo(
    () => automations.filter((item) => item.status === "active"),
    [automations],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return automations.filter((item) => {
      if (listFilter === "active" && item.status !== "active") return false;
      if (
        listFilter === "inactive" &&
        item.status !== "paused" &&
        item.status !== "draft"
      ) {
        return false;
      }
      if (listFilter === "needs_attention" && !attentionAutomationIds.has(item.id)) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        automationLabel(item, t),
        t(item.descriptionKey),
        t(item.triggerLabelKey),
        t(item.triggerHelperKey),
        item.type,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [attentionAutomationIds, automations, listFilter, search, t]);

  const selected = automations.find((item) => item.id === selectedId) ?? null;
  const selectedRun = runs.find((run) => run.id === runId) ?? null;
  const selectedRunAutomation =
    automations.find((item) => item.id === selectedRun?.automationId) ?? null;

  if (!canRead) {
    return (
      <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-6">
        <p className="text-sm text-[#7d8aa0]">{t("forbidden")}</p>
      </main>
    );
  }

  function selectAutomation(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
  }

  function handleReview(item: AutomationReviewItem) {
    // Navigate only — item stays in Needs attention until actually resolved.
    if (item.type === "bank_match") {
      router.push("/paiements");
      setNotice(t("toast.openReconciliation"));
      return;
    }
    if (item.type === "reminder_draft") {
      router.push("/paiements");
      setNotice(t("toast.openReminder"));
      return;
    }
    router.push("/devis");
    setNotice(t("toast.openQuote"));
  }

  function handleRunActivityAction(kind: AutomationRunActivityAction) {
    if (kind === "bank_review") {
      router.push("/paiements");
      setNotice(t("toast.openReconciliation"));
      return;
    }
    if (kind === "reminder_review") {
      router.push("/paiements");
      setNotice(t("toast.openReminder"));
      return;
    }
    router.push("/devis");
    setNotice(t("toast.openQuote"));
  }

  function showAllRuns() {
    setMainTab("automations");
  }

  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div data-scroll-chain-page={mainTab === "overview" ? "true" : undefined} className="dashboard-scroll dashboard-page dashboard-stack flex min-h-0 min-w-0 flex-1 flex-col gap-[var(--dashboard-gap)] overflow-x-hidden overflow-y-auto pb-6">
        {canManage ? (
          <header className="dashboard-enter enter-0 flex shrink-0 justify-end">
            <button
              className="action-motion soft-primary inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] px-3 text-xs font-semibold text-white"
              type="button"
              onClick={() => setNewOpen(true)}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              {t("new")}
            </button>
          </header>
        ) : null}

        <div className="dashboard-enter enter-1 shrink-0">
          <AutomationKpisStrip
            kpis={kpis}
            onNeedsAttention={() => setMainTab("overview")}
          />
        </div>

        <AnimatedSelectionGroup
          className="dashboard-enter enter-2 shrink-0"
          id="automation-main-tabs"
        >
          <div
            aria-label={t("tabsLabel")}
            className="flex min-w-0 gap-1 overflow-x-auto"
            role="tablist"
          >
            {(["overview", "automations"] as const).map((tab) => {
              const active = mainTab === tab;
              return (
                <button
                  aria-selected={active}
                  className={cn(
                    "relative shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors",
                    active ? "text-[#2458d6]" : "text-[#7d8aa0] hover:text-[#405069]",
                  )}
                  key={tab}
                  role="tab"
                  type="button"
                  onClick={() => setMainTab(tab)}
                >
                  {active ? (
                    <AnimatedActiveIndicator
                      className="rounded-full"
                      layoutId="automation-main-tab"
                      variant="soft-pill"
                    />
                  ) : null}
                  <span className="relative z-[1]">
                    {t(`tabs.${tab}`)}
                    {tab === "automations" ? ` (${automations.length})` : null}
                  </span>
                </button>
              );
            })}
          </div>
        </AnimatedSelectionGroup>

        {mainTab === "overview" ? (
          <div
            className="dashboard-enter enter-3 flex min-w-0 flex-col gap-[var(--dashboard-gap)]"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <NeedsAttentionPanel
              automations={automations}
              items={reviewItems}
              limit={5}
              onReview={canReview ? handleReview : undefined}
            />

            <section className="dashboard-card dashboard-list flex h-[min(360px,46vh)] min-h-[240px] min-w-0 flex-col overflow-hidden sm:min-h-[280px]">
              <div className="shrink-0 border-b border-[#edf2f8] px-3.5 py-3">
                <h2 className="dashboard-card-title flex items-center gap-1.5">
                  {t("overview.activeTitle")}
                  {activeAutomations.length > 0 ? (
                    <span className="rounded-full bg-[#e8f7f0] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#238567]">
                      {activeAutomations.length}
                    </span>
                  ) : null}
                </h2>
                <p className="dashboard-label mt-0.5 text-[11px]">
                  {t("overview.activeSubtitle")}
                </p>
              </div>
              <AutomationList
                canManage={canManage}
                items={activeAutomations}
                selectedId={detailOpen ? selectedId : null}
                onSelect={selectAutomation}
              />
            </section>

            <AutomationRecentRuns
              automations={automations}
              limit={8}
              runs={runs}
              onView={(id) => openRun(id, false)}
              onViewAll={showAllRuns}
            />
          </div>
        ) : null}

        {mainTab === "automations" ? (
          <div
            className="dashboard-enter enter-3 flex min-w-0 flex-col gap-[var(--dashboard-gap)]"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <section className="dashboard-card dashboard-list flex h-[min(420px,52vh)] min-h-[260px] min-w-0 flex-col overflow-hidden sm:min-h-[300px]">
              <div className="flex shrink-0 flex-col gap-2.5 border-b border-[#edf2f8] px-3.5 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="dashboard-card-title text-[15px]">{t("list.title")}</h2>
                    <p className="dashboard-label mt-0.5 text-[11px]">
                      {t("list.subtitle", { count: filtered.length })}
                    </p>
                  </div>
                  <label className="relative min-w-0 w-full sm:max-w-[18rem] md:max-w-[22rem]">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#98a4b5]"
                    />
                    <input
                      className="compte-search-input h-9 w-full min-w-0 rounded-[9px] border border-[#e1e7f1] bg-white pr-3 pl-8 text-xs outline-none"
                      placeholder={t("search")}
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>
                <AnimatedSelectionGroup id="automation-list-filters">
                  <div
                    aria-label={t("filters.tabsLabel")}
                    className="flex min-w-0 flex-wrap gap-1.5 overflow-x-auto pb-0.5"
                    role="group"
                  >
                    {(
                      [
                        ["all", "filters.allAutomations", listCounts.all],
                        ["active", "filters.active", listCounts.active],
                        ["inactive", "filters.inactive", listCounts.inactive],
                        [
                          "needs_attention",
                          "filters.needsAttention",
                          listCounts.needs_attention,
                        ],
                      ] as const
                    ).map(([value, labelKey, count]) => {
                      const active = listFilter === value;
                      return (
                        <button
                          aria-pressed={active}
                          className={cn(
                            "dashboard-pill dashboard-pill--list relative gap-1.5",
                            active && "dashboard-pill--indicator-active",
                          )}
                          key={value}
                          type="button"
                          onClick={() => setListFilter(value)}
                        >
                          {active ? (
                            <AnimatedActiveIndicator
                              className="rounded-full"
                              layoutId="automation-list-filter"
                              variant="soft-pill"
                            />
                          ) : null}
                          <span className="relative z-[1] inline-flex items-center gap-1.5">
                            {t(labelKey)}
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                                active
                                  ? "bg-[#dfeaff] text-[#2458d6]"
                                  : "bg-[#eef1f6] text-[#7d8aa0]",
                              )}
                            >
                              {count}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </AnimatedSelectionGroup>
              </div>
              <AutomationList
                canManage={canManage}
                items={filtered}
                selectedId={detailOpen ? selectedId : null}
                onSelect={selectAutomation}
              />
            </section>

            <div className="min-w-0">
              <AutomationRecentRuns
                automations={automations}
                runs={runs}
                onView={(id) => openRun(id, false)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <FormSheet
        closeLabel={t("detail.close")}
        contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
        open={detailOpen && selected !== null}
        showHeader={false}
        title={selected ? automationLabel(selected, t) : t("detail.emptyTitle")}
        widthClassName="sm:max-w-[560px] md:max-w-[640px]"
        zIndexClassName="z-[60]"
        onClose={runId !== null ? () => undefined : closeDetail}
      >
        <AutomationDetail
          key={selected?.id ?? "none"}
          automation={selected}
          canManage={canManage}
          runs={runs}
          onClose={closeDetail}
          onViewRun={(id) => openRun(id, true)}
        />
      </FormSheet>

      <NewAutomationSheet
        open={newOpen && canManage}
        onActivated={(id) => {
          setNewOpen(false);
          setSelectedId(id);
          setDetailOpen(true);
          setMainTab("automations");
          setNotice(t("toast.activated"));
        }}
        onClose={() => setNewOpen(false)}
      />

      <RunDetailSheet
        automation={selectedRunAutomation}
        canGoBack={runReturnToDetail}
        open={runId !== null}
        run={selectedRun}
        onActivityAction={canReview ? handleRunActivityAction : undefined}
        onClose={closeRun}
      />

      <SoftToast message={notice} onDismiss={() => setNotice("")} />
    </main>
  );
}
