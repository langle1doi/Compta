"use client";

import {
  Archive,
  Ellipsis,
  FileText,
  Mail,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
  TOP_TABS_ACTIVE_LAYOUT_ID,
} from "@/components/compte/animated-selection";
import { ConfirmDialog } from "@/components/compte/confirm-dialog";
import { CountryFlag } from "@/components/compte/country-flag";
import { SoftToast } from "@/components/compte/soft-toast";
import { useCan } from "@/features/settings/can";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useApiErrorMessage } from "@/lib/api/use-api-error";
import { cn } from "@/lib/utils";

import {
  canSaveCustomerDraft,
  draftsEqual,
  recordToDraft,
  type CustomerDraft,
} from "../customer-draft";
import {
  createInvoiceFromAcceptedQuote,
  hasAcceptedQuoteReady,
  hasEligibleInvoiceForPayment,
  recordMockPayment,
} from "../customer-history";
import { AVAILABLE_TAGS } from "../mocks/customers";
import { customerInitials, customerTermsLabel } from "../query";
import { customerFieldErrors, type CustomerFieldErrors } from "../services/customers-adapter";
import { useCustomerMutations } from "../services/customers-service";
import { isOptionalSiretValid } from "../services/siret-lookup";
import type {
  CustomerOwner,
  CustomerPaymentTerms,
  CustomerRecord,
  PaymentMethod,
} from "../types";
import { CustomerActivityTab } from "./customer-activity-tab";
import { CountrySelectField } from "./country-select-field";
import {
  CustomerInvoicesTab,
  CustomerPaymentsTab,
  CustomerQuotesTab,
} from "./customer-resource-history-tab";
import { PhoneInputField } from "./phone-input-field";

const tabs = ["details", "activity", "quotes", "invoices", "payments"] as const;
type DetailTab = (typeof tabs)[number];
type PanelMode = "view" | "edit";
type PendingConfirm =
  | { type: "discard"; run: () => void }
  | { type: "typeChange"; run: () => void }
  | { type: "deleteContact"; run: () => void }
  | { type: "deletePrimaryContact"; run: () => void }
  | { type: "archive"; run: () => void }
  | { type: "deleteCustomer"; run: () => void };

export function CustomerDetailsPanel({
  customer,
  owner,
  owners = [],
  canUpdate,
  onClose,
  onSaved,
  onDeleted,
  onPatchCustomer,
  onDuplicateFound,
  onEditingChange,
  embedded = false,
}: {
  customer: CustomerRecord | null;
  owner?: CustomerOwner;
  owners?: CustomerOwner[];
  canUpdate: boolean;
  onClose?: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
  /** In-memory history mutations (invoice/payment mock) without leaving view mode. */
  onPatchCustomer?: (customer: CustomerRecord) => void;
  onDuplicateFound?: (draft: CustomerDraft, resume: () => void) => void;
  onEditingChange?: (state: { editing: boolean; dirty: boolean }) => void;
  embedded?: boolean;
}) {
  const t = useTranslations("customers");
  const pathname = usePathname();
  const router = useRouter();
  const [tab, setTab] = useState<DetailTab>("details");
  const [moreOpen, setMoreOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("view");
  const [draft, setDraft] = useState<CustomerDraft | null>(null);
  const [baseline, setBaseline] = useState<CustomerDraft | null>(null);
  const [siretTouched, setSiretTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<CustomerFieldErrors>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const check = useCan();
  const { message, fieldMessage } = useApiErrorMessage();
  const mutations = useCustomerMutations();
  const canCreateQuote = check("quote.create");
  const canCreateInvoice = check("invoice.create");
  const canRecordPayment = check("payment.create");
  const canDelete = check("customer.delete");
  const visibleTabs = tabs.filter(
    (item) =>
      (item !== "quotes" || check("quote.read")) &&
      (item !== "invoices" || check("invoice.read")) &&
      (item !== "payments" || check("payment.read")),
  );
  const quickActionCount =
    2 + Number(canCreateQuote) + Number(canCreateInvoice) + Number(canRecordPayment);

  const dirty = Boolean(draft && baseline && !draftsEqual(draft, baseline));
  const editing = mode === "edit" && draft !== null;
  const onFullCustomerPage = Boolean(
    customer && pathname.includes(`/customers/${customer.id}`),
  );

  function notifyEditing(nextMode: PanelMode, nextDirty: boolean) {
    onEditingChange?.({ editing: nextMode === "edit", dirty: nextDirty });
  }

  const canSave = useMemo(() => (draft ? canSaveCustomerDraft(draft) : false), [draft]);

  function exitEdit() {
    setMode("view");
    setDraft(null);
    setBaseline(null);
    setError("");
    setServerErrors({});
    setSiretTouched(false);
    notifyEditing("view", false);
  }

  function startEdit() {
    if (!customer || !canUpdate) return;
    const next = recordToDraft(customer);
    setDraft(next);
    setBaseline(next);
    setMode("edit");
    setTab("details");
    setMoreOpen(false);
    setError("");
    setServerErrors({});
    setSiretTouched(false);
    notifyEditing("edit", false);
  }

  function cancelEdit() {
    if (!dirty) {
      exitEdit();
      return;
    }
    setPendingConfirm({ type: "discard", run: () => exitEdit() });
  }

  function patch(partial: Partial<CustomerDraft>) {
    setServerErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(partial)) delete next[key as keyof CustomerDraft];
      return next;
    });
    setDraft((current) => {
      if (!current || !baseline) return current;
      const next = { ...current, ...partial };
      notifyEditing("edit", !draftsEqual(next, baseline));
      return next;
    });
  }

  async function handleSave(force = false) {
    if (!customer || !draft || !baseline) return;
    if (draft.type === "company" && !isOptionalSiretValid(draft.siret)) {
      setSiretTouched(true);
      setError(t("form.siretError"));
      return;
    }
    if (!canSave) {
      setError(t("form.required"));
      return;
    }
    if (!force && onDuplicateFound) {
      onDuplicateFound(draft, () => void handleSave(true));
      return;
    }
    setSaving(true);
    try {
      await mutations.saveEdit.mutateAsync({ customer, baseline, draft });
      exitEdit();
      onSaved?.();
    } catch (caught) {
      setServerErrors(customerFieldErrors(caught, fieldMessage));
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: () => Promise<unknown>, successNotice?: string) {
    setMoreOpen(false);
    setError("");
    try {
      await action();
      if (successNotice) setNotice(successNotice);
    } catch (caught) {
      setError(message(caught));
    }
  }

  function toggleArchive() {
    if (!customer) return;
    const { id, status } = customer;
    if (status === "inactive") {
      void runAction(
        () => mutations.setStatus.mutateAsync({ id, status: "ACTIVE" }),
        t("details.restored"),
      );
      return;
    }
    setMoreOpen(false);
    setPendingConfirm({
      type: "archive",
      run: () =>
        void runAction(
          () => mutations.setStatus.mutateAsync({ id, status: "ARCHIVED" }),
          t("details.archived"),
        ),
    });
  }

  function requestDelete() {
    if (!customer) return;
    const { id } = customer;
    setMoreOpen(false);
    setPendingConfirm({
      type: "deleteCustomer",
      run: () =>
        void runAction(async () => {
          await mutations.remove.mutateAsync(id);
          onDeleted?.();
        }),
    });
  }

  function requestTab(next: DetailTab) {
    if (editing && dirty && next !== "details") {
      setPendingConfirm({
        type: "discard",
        run: () => {
          exitEdit();
          setTab(next);
        },
      });
      return;
    }
    if (editing && next !== "details") {
      return;
    }
    setTab(next);
  }

  const confirmCopy =
    pendingConfirm?.type === "discard"
      ? {
          title: t("details.discardTitle"),
          body: t("details.discardConfirm"),
          confirmLabel: t("details.discardAction"),
          cancelLabel: t("details.keepEditing"),
          danger: true,
        }
      : pendingConfirm?.type === "typeChange"
        ? {
            title: t("details.typeChangeTitle"),
            body: t("details.typeChangeConfirm"),
            confirmLabel: t("details.typeChangeAction"),
            cancelLabel: t("form.cancel"),
            danger: false,
          }
        : pendingConfirm?.type === "deletePrimaryContact"
          ? {
              title: t("details.deletePrimaryContactTitle"),
              body: t("details.deletePrimaryContactConfirm"),
              confirmLabel: t("details.deleteContactAction"),
              cancelLabel: t("form.cancel"),
              danger: true,
            }
          : pendingConfirm?.type === "deleteContact"
            ? {
                title: t("details.deleteContactTitle"),
                body: t("details.deleteContactConfirm"),
                confirmLabel: t("details.deleteContactAction"),
                cancelLabel: t("form.cancel"),
                danger: true,
              }
            : pendingConfirm?.type === "archive"
              ? {
                  title: t("details.archiveTitle"),
                  body: t("details.archiveConfirm"),
                  confirmLabel: t("details.archive"),
                  cancelLabel: t("form.cancel"),
                  danger: false,
                }
              : pendingConfirm?.type === "deleteCustomer"
                ? {
                    title: t("details.deleteCustomerTitle"),
                    body: t("details.deleteCustomerConfirm"),
                    confirmLabel: t("details.deleteCustomer"),
                    cancelLabel: t("form.cancel"),
                    danger: true,
                  }
                : null;

  const display = customer;

  if (!display) {
    return (
      <section
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden px-4 py-6 text-center",
          !embedded && "dashboard-card",
        )}
      >
        <p className="text-sm font-semibold text-[#24334c]">{t("details.emptyTitle")}</p>
        <p className="mt-1 max-w-[28ch] text-xs leading-5 text-[#7d8aa0]">{t("details.emptyBody")}</p>
      </section>
    );
  }

  const billing = display.addresses.find((address) => address.type === "billing");
  const delivery = display.addresses.find((address) => address.type === "delivery");
  const activeOwner =
    owners.find((item) => item.id === (editing ? draft?.ownerId : display.ownerId)) ?? owner;

  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden",
        !embedded && "dashboard-card",
      )}
    >
      <div className="sticky top-0 z-10 shrink-0 bg-white/95 backdrop-blur-sm">
        <AnimatedSelectionGroup
          className="min-w-0 border-b border-[#edf2f8] px-1.5"
          id="customer-detail-tabs"
        >
          <div
            aria-label={t("details.tabsLabel")}
            className="flex min-w-0 gap-0.5 py-1.5"
            role="tablist"
          >
            {visibleTabs.map((item) => {
              const active = tab === item;
              const locked = editing && item !== "details";
              return (
                <button
                  aria-selected={active}
                  className={cn(
                    "relative min-w-0 flex-1 truncate rounded-full px-1.5 py-2 text-[11px] font-semibold transition-colors duration-150",
                    active ? "text-[#2458d6]" : "text-[#7d8aa0] hover:text-[#405069]",
                    locked && "opacity-45",
                  )}
                  disabled={locked && !dirty}
                  key={item}
                  onClick={() => requestTab(item)}
                  role="tab"
                  type="button"
                >
                  {active ? (
                    <AnimatedActiveIndicator
                      className="rounded-full"
                      layoutId={`${TOP_TABS_ACTIVE_LAYOUT_ID}-customer-details`}
                      variant="soft-pill"
                    />
                  ) : null}
                  <span className="relative z-[1] truncate">{t(`tabs.${item}`)}</span>
                </button>
              );
            })}
          </div>
        </AnimatedSelectionGroup>

        <header className="border-b border-[#edf2f8] px-3.5 py-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf1ff] text-xs font-semibold text-[#1857d7]">
              {customerInitials(display)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <h3
                      className="truncate text-[15px] font-semibold text-[#063586]"
                      title={editing ? draft.displayName : display.displayName}
                    >
                      {editing ? draft.displayName || display.displayName : display.displayName}
                    </h3>
                    {editing ? (
                      <span className="rounded-[5px] bg-[#fff4e8] px-1.5 py-0.5 text-[10px] font-semibold text-[#c46b12]">
                        {t("details.editing")}
                      </span>
                    ) : null}
                    {dirty ? (
                      <span className="rounded-[5px] bg-[#e7efff] px-1.5 py-0.5 text-[10px] font-semibold text-[#044ce2]">
                        {t("details.unsaved")}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                    <span className="rounded-[5px] bg-[#eef3fa] px-1.5 py-0.5 text-[10px] font-semibold text-[#516078]">
                      {t(`type.${editing ? draft.type : display.type}`)}
                    </span>
                    <span
                      className={cn(
                        "rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold",
                        display.status === "active"
                          ? "bg-[#e6f7ef] text-[#0f8a5f]"
                          : "bg-[#eef1f5] text-[#66758d]",
                      )}
                    >
                      {t(`status.${display.status}`)}
                    </span>
                  </div>
                  {activeOwner ? (
                    <p className="mt-1 truncate text-[11px] text-[#7d8aa0]">
                      {t("details.owner", { name: activeOwner.name })}
                    </p>
                  ) : null}
                </div>

                {editing ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      className="action-motion soft-button inline-flex h-8 items-center rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
                      disabled={saving}
                      onClick={cancelEdit}
                      type="button"
                    >
                      {t("form.cancel")}
                    </button>
                    <button
                      className="action-motion soft-primary inline-flex h-8 items-center rounded-[8px] px-2.5 text-[11px] font-semibold text-white disabled:opacity-50"
                      disabled={!canSave || saving}
                      onClick={() => void handleSave(false)}
                      type="button"
                    >
                      {saving ? t("details.saving") : t("form.editSave")}
                    </button>
                  </div>
                ) : (
                  <>
                    {canUpdate ? (
                      <button
                        className="action-motion soft-button inline-flex h-8 shrink-0 items-center gap-1 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
                        onClick={startEdit}
                        type="button"
                      >
                        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                        {t("details.edit")}
                      </button>
                    ) : null}
                    {onClose ? (
                      <button
                        aria-label={t("details.close")}
                        className="action-motion grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#7d8aa0] hover:bg-white"
                        onClick={onClose}
                        type="button"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          {!editing ? (
            <div
              className="relative mt-3 grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${quickActionCount}, minmax(0, 1fr))` }}
            >
              {canCreateQuote ? (
                <QuickAction
                  icon={Plus}
                  label={t("actions.newQuote")}
                  onClick={() => {
                    requestTab("quotes");
                    router.push(
                      `/devis?create=1&customer=${encodeURIComponent(display.id)}&name=${encodeURIComponent(display.displayName)}`,
                    );
                  }}
                />
              ) : null}
              {canCreateInvoice ? (
                <QuickAction
                  disabled={!hasAcceptedQuoteReady(display)}
                  icon={ReceiptText}
                  label={t("actions.newInvoice")}
                  title={
                    !hasAcceptedQuoteReady(display)
                      ? t("actions.invoiceAcceptedRequired")
                      : t("actions.invoiceHint")
                  }
                  onClick={() => {
                    if (!onPatchCustomer) return;
                    const next = createInvoiceFromAcceptedQuote(
                      display,
                      activeOwner?.name ?? "You",
                    );
                    if (!next) {
                      setError(t("actions.invoiceAcceptedRequired"));
                      return;
                    }
                    onPatchCustomer(next);
                    setNotice(t("historyTabs.invoiceCreatedToast"));
                    setTab("invoices");
                  }}
                />
              ) : null}
              {canRecordPayment ? (
                <QuickAction
                  disabled={!hasEligibleInvoiceForPayment(display)}
                  icon={WalletCards}
                  label={t("actions.recordPayment")}
                  title={
                    !hasEligibleInvoiceForPayment(display)
                      ? t("actions.paymentHint")
                      : undefined
                  }
                  onClick={() => {
                    if (!onPatchCustomer) return;
                    const next = recordMockPayment(display, activeOwner?.name ?? "You");
                    if (!next) {
                      setError(t("actions.paymentHint"));
                      return;
                    }
                    onPatchCustomer(next);
                    setNotice(t("historyTabs.paymentRecordedToast"));
                    setTab("payments");
                  }}
                />
              ) : null}
              <QuickAction
                disabled={!display.email}
                href={display.email ? `mailto:${display.email}` : undefined}
                icon={Mail}
                label={t("actions.email")}
              />
              <button
                aria-expanded={moreOpen}
                className="action-motion soft-button flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-2 text-[#405069]"
                onClick={() => setMoreOpen((value) => !value)}
                type="button"
              >
                <Ellipsis aria-hidden="true" className="h-3.5 w-3.5 text-[#044ce2]" />
                <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">
                  {t("actions.more")}
                </span>
              </button>
              {moreOpen ? (
                <div className="absolute top-[calc(100%+4px)] right-0 z-20 w-44 rounded-[10px] border border-white/80 bg-white/95 p-1 shadow-[6px_10px_24px_rgba(78,108,145,0.12)]">
                  {!onFullCustomerPage ? (
                    <Link
                      className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-xs font-semibold text-[#405069] hover:bg-[#f5f8fd]"
                      href={`/customers/${display.id}`}
                      onClick={() => setMoreOpen(false)}
                    >
                      <FileText aria-hidden="true" className="h-3.5 w-3.5 text-[#044ce2]" />
                      {t("details.openFull")}
                    </Link>
                  ) : null}
                  {check("quote.read") ? (
                    <button
                      className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold text-[#405069] hover:bg-[#f5f8fd]"
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        requestTab("quotes");
                      }}
                    >
                      <ReceiptText aria-hidden="true" className="h-3.5 w-3.5 text-[#044ce2]" />
                      {t("details.viewQuotes")}
                    </button>
                  ) : null}
                  {canUpdate ? (
                    <button
                      className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold text-[#405069] hover:bg-[#f5f8fd]"
                      type="button"
                      onClick={toggleArchive}
                    >
                      {display.status === "active" ? (
                        <Archive aria-hidden="true" className="h-3.5 w-3.5 text-[#044ce2]" />
                      ) : (
                        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 text-[#044ce2]" />
                      )}
                      {display.status === "active" ? t("details.archive") : t("details.restore")}
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold text-[#b42318] hover:bg-[#fff1f0]"
                      type="button"
                      onClick={requestDelete}
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      {t("details.deleteCustomer")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </header>
      </div>

      <div className="customer-detail-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-2.5">
        {tab === "details" ? (
          <div
            className="min-w-0 space-y-2 transition-[opacity,transform] duration-150 ease-out"
            key="details"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <Accordion
              defaultOpen
              title={
                (editing ? draft.type : display.type) === "company"
                  ? t("sections.companyInformation")
                  : t("sections.identity")
              }
            >
              {editing && draft ? (
                <div className="space-y-2.5 transition-opacity duration-150">
                  <TypeToggle
                    onChange={(type) => {
                      if (type === draft.type) return;
                      if (
                        draft.type === "company" &&
                        type === "individual" &&
                        (draft.siret || draft.vatNumber)
                      ) {
                        setPendingConfirm({
                          type: "typeChange",
                          run: () => patch({ type }),
                        });
                        return;
                      }
                      patch({ type });
                    }}
                    value={draft.type}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <EditField
                      error={serverErrors.displayName}
                      label={
                        draft.type === "company" ? t("fields.displayName") : t("fields.fullName")
                      }
                      onChange={(value) => patch({ displayName: value })}
                      required
                      value={draft.displayName}
                    />
                    {draft.type === "company" ? (
                      <EditField
                        error={
                          siretTouched && !isOptionalSiretValid(draft.siret)
                            ? t("form.siretError")
                            : serverErrors.siret
                        }
                        label={t("fields.siret")}
                        onBlur={() => setSiretTouched(true)}
                        onChange={(value) => patch({ siret: value })}
                        value={draft.siret}
                      />
                    ) : null}
                    {draft.type === "company" ? (
                      <EditField
                        error={serverErrors.vatNumber}
                        label={t("fields.vat")}
                        onChange={(value) => patch({ vatNumber: value })}
                        value={draft.vatNumber}
                      />
                    ) : null}
                    <CountrySelectField
                      label={t("fields.country")}
                      valueCode={draft.billingCountryCode}
                      onChange={(country) =>
                        patch({
                          billingCountry: country.name,
                          billingCountryCode: country.code,
                        })
                      }
                    />
                    <EditField
                      error={serverErrors.email}
                      label={t("fields.email")}
                      onChange={(value) => patch({ email: value })}
                      value={draft.email}
                    />
                    <PhoneInputField
                      label={t("fields.phone")}
                      onChange={(value) => patch({ phone: value })}
                      value={draft.phone}
                    />
                    <EditField
                      error={serverErrors.website}
                      label={t("fields.website")}
                      onChange={(value) => patch({ website: value })}
                      value={draft.website}
                    />
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
                  {display.type === "company" ? (
                    <>
                      <ViewField label={t("fields.displayName")} value={display.displayName} />
                      <ViewField label={t("fields.siret")} value={display.siret ?? "—"} />
                      <ViewCountryField
                        code={billing?.countryCode}
                        label={t("fields.country")}
                        name={billing?.country}
                      />
                      <ViewField label={t("fields.vat")} value={display.vatNumber ?? "—"} />
                    </>
                  ) : (
                    <>
                      <ViewField label={t("fields.fullName")} value={display.displayName} />
                      <ViewCountryField
                        code={billing?.countryCode}
                        label={t("fields.country")}
                        name={billing?.country}
                      />
                    </>
                  )}
                  <ViewField label={t("fields.email")} value={display.email || "—"} />
                  <ViewField label={t("fields.phone")} value={display.phone ?? "—"} />
                  <ViewField label={t("fields.website")} value={display.website ?? "—"} />
                </dl>
              )}
            </Accordion>

            <Accordion defaultOpen title={t("sections.commercial")}>
              {editing && draft ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 transition-opacity duration-150">
                  <SelectField
                    label={t("fields.paymentTerms")}
                    onChange={(value) => patch({ paymentTerms: value as CustomerPaymentTerms })}
                    options={[
                      ...["net_15", "net_30", "net_45", "net_60", "upon_receipt"].map((value) => ({
                        value,
                        label: t(`terms.${value}`),
                      })),
                      // Keep a stored value the list cannot express, or the select would misreport it.
                      ...(draft.paymentTerms === "custom" || draft.paymentTerms === "unset"
                        ? [{ value: draft.paymentTerms, label: customerTermsLabel(t, display) }]
                        : []),
                    ]}
                    value={draft.paymentTerms}
                  />
                  <SelectField
                    label={t("fields.paymentMethod")}
                    onChange={(value) => patch({ paymentMethod: value as PaymentMethod })}
                    options={[
                      ...new Set(["transfer", "check", "card", "direct_debit", draft.paymentMethod]),
                    ].map((value) => ({
                      value,
                      label: t(`methods.${value}`),
                    }))}
                    value={draft.paymentMethod}
                  />
                  {owners.length ? (
                    <SelectField
                      label={t("fields.owner")}
                      onChange={(value) => patch({ ownerId: value })}
                      options={owners.map((item) => ({ value: item.id, label: item.name }))}
                      value={draft.ownerId}
                    />
                  ) : null}
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[11px] font-medium text-[#7d8aa0]">{t("fields.tags")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        ...new Set([
                          ...AVAILABLE_TAGS.filter((tag) => tag !== "Duplicate"),
                          ...draft.tags,
                        ]),
                      ].map((tag) => {
                        const active = draft.tags.includes(tag);
                        return (
                          <button
                            className={cn(
                              "rounded-[6px] px-2 py-1 text-[11px] font-semibold",
                              active ? "bg-[#e7efff] text-[#044ce2]" : "bg-[#eef3fa] text-[#66758d]",
                            )}
                            key={tag}
                            onClick={() =>
                              patch({
                                tags: active
                                  ? draft.tags.filter((item) => item !== tag)
                                  : [...draft.tags, tag],
                              })
                            }
                            type="button"
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
                  <ViewField
                    label={t("fields.paymentTerms")}
                    value={customerTermsLabel(t, display)}
                  />
                  <ViewField
                    label={t("fields.paymentMethod")}
                    value={t(`methods.${display.paymentMethod}`)}
                  />
                </dl>
              )}
            </Accordion>

            <Accordion
              defaultOpen
              title={t("sections.contacts", {
                count: editing && draft ? draft.contacts.length : display.contacts.length,
              })}
            >
              {editing && draft ? (
                <div className="space-y-2 transition-opacity duration-150">
                  {draft.contacts.map((contact, index) => (
                    <div
                      className="rounded-[8px] border border-[#e8eef7] bg-white/70 px-2.5 py-2"
                      key={contact.id}
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <EditField
                          label={t("fields.contactName")}
                          onChange={(value) => {
                            const contacts = [...draft.contacts];
                            contacts[index] = { ...contact, name: value };
                            patch({ contacts });
                          }}
                          value={contact.name}
                        />
                        <EditField
                          label={t("fields.contactEmail")}
                          onChange={(value) => {
                            const contacts = [...draft.contacts];
                            contacts[index] = { ...contact, email: value };
                            patch({ contacts });
                          }}
                          value={contact.email}
                        />
                        <PhoneInputField
                          label={t("fields.contactPhone")}
                          onChange={(value) => {
                            const contacts = [...draft.contacts];
                            contacts[index] = { ...contact, phone: value };
                            patch({ contacts });
                          }}
                          value={contact.phone}
                        />
                        <label className="flex items-end gap-2 pb-2 text-[11px] text-[#516078]">
                          <input
                            checked={contact.primary}
                            className="accent-[#044ce2]"
                            onChange={(event) => {
                              const contacts = draft.contacts.map((item, i) => ({
                                ...item,
                                primary: event.target.checked ? i === index : false,
                              }));
                              patch({ contacts });
                            }}
                            type="checkbox"
                          />
                          {t("details.primary")}
                        </label>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          className="inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[10px] font-semibold text-[#d1492a] hover:bg-[#fff4f2]"
                          onClick={() => {
                            const remove = () => {
                              const contacts = draft.contacts.filter(
                                (item) => item.id !== contact.id,
                              );
                              if (contacts.length && !contacts.some((item) => item.primary)) {
                                contacts[0] = { ...contacts[0], primary: true };
                              }
                              patch({ contacts });
                            };
                            if (contact.primary && draft.contacts.length > 1) {
                              setPendingConfirm({ type: "deletePrimaryContact", run: remove });
                              return;
                            }
                            setPendingConfirm({ type: "deleteContact", run: remove });
                          }}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="h-3 w-3" />
                          {t("details.deleteContact")}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    className="action-motion soft-button inline-flex h-8 items-center gap-1 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#044ce2]"
                    onClick={() =>
                      patch({
                        contacts: [
                          ...draft.contacts,
                          {
                            id: `ct-${Date.now()}`,
                            name: "",
                            email: "",
                            phone: "",
                            primary: draft.contacts.length === 0,
                          },
                        ],
                      })
                    }
                    type="button"
                  >
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                    {t("details.addContact")}
                  </button>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {display.contacts.map((contact) => (
                    <li className="rounded-[8px] bg-white/65 px-2.5 py-1.5" key={contact.id}>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-[#24334c]">{contact.name}</p>
                        {contact.primary ? (
                          <span className="shrink-0 rounded-[4px] bg-[#e7efff] px-1 py-0.5 text-[9px] font-semibold text-[#044ce2]">
                            {t("details.primary")}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] text-[#7d8aa0]">{contact.email}</p>
                      {contact.phone ? (
                        <p className="truncate text-[11px] text-[#7d8aa0]">{contact.phone}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Accordion>

            <Accordion
              defaultOpen
              title={t("sections.addresses", {
                count: display.addresses.length,
              })}
            >
              {editing && draft ? (
                <div className="space-y-2.5 transition-opacity duration-150">
                  <p className="text-[11px] font-semibold text-[#24334c]">{t("address.billing")}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <EditField
                      className="sm:col-span-2"
                      error={serverErrors.billingLine1}
                      label={t("fields.line1")}
                      onChange={(value) => patch({ billingLine1: value })}
                      required
                      value={draft.billingLine1}
                    />
                    <EditField
                      error={serverErrors.billingPostalCode}
                      label={t("fields.postalCode")}
                      onChange={(value) => patch({ billingPostalCode: value })}
                      required
                      value={draft.billingPostalCode}
                    />
                    <EditField
                      error={serverErrors.billingCity}
                      label={t("fields.city")}
                      onChange={(value) => patch({ billingCity: value })}
                      required
                      value={draft.billingCity}
                    />
                    <CountrySelectField
                      className="sm:col-span-2"
                      label={t("fields.country")}
                      valueCode={draft.billingCountryCode}
                      onChange={(country) =>
                        patch({
                          billingCountry: country.name,
                          billingCountryCode: country.code,
                        })
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[#516078]">
                    <input
                      checked={draft.useBillingForDelivery}
                      className="accent-[#044ce2]"
                      onChange={(event) => patch({ useBillingForDelivery: event.target.checked })}
                      type="checkbox"
                    />
                    {t("form.useBillingForDelivery")}
                  </label>
                  {!draft.useBillingForDelivery ? (
                    <>
                      <p className="text-[11px] font-semibold text-[#24334c]">
                        {t("address.delivery")}
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <EditField
                          className="sm:col-span-2"
                          label={t("fields.line1")}
                          onChange={(value) => patch({ deliveryLine1: value })}
                          value={draft.deliveryLine1}
                        />
                        <EditField
                          label={t("fields.postalCode")}
                          onChange={(value) => patch({ deliveryPostalCode: value })}
                          value={draft.deliveryPostalCode}
                        />
                        <EditField
                          label={t("fields.city")}
                          onChange={(value) => patch({ deliveryCity: value })}
                          value={draft.deliveryCity}
                        />
                        <CountrySelectField
                          className="sm:col-span-2"
                          label={t("fields.country")}
                          valueCode={draft.deliveryCountryCode}
                          onChange={(country) =>
                            patch({
                              deliveryCountry: country.name,
                              deliveryCountryCode: country.code,
                            })
                          }
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {billing ? <AddressCard label={t("address.billing")} address={billing} /> : null}
                  {delivery ? (
                    <AddressCard label={t("address.delivery")} address={delivery} />
                  ) : null}
                </div>
              )}
            </Accordion>

            <Accordion
              defaultOpen={display.notes.length > 0}
              title={t("sections.notes", { count: display.notes.length })}
            >
              {display.notes.length === 0 ? (
                <p className="py-0.5 text-[11px] text-[#7d8aa0]">{t("details.noNotes")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {display.notes.map((note) => (
                    <li
                      className="rounded-[8px] bg-white/65 px-2.5 py-1.5 text-[11px] leading-4 text-[#405069]"
                      key={note.id}
                    >
                      <p>{note.body}</p>
                      <p className="mt-1 text-[10px] text-[#98a4b5]">
                        {note.authorName} · {new Date(note.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Accordion>

            {!editing && canUpdate ? (
              <Accordion
                defaultOpen={display.sharedWithOwnerIds.length > 0}
                title={t("sections.shares", { count: display.sharedWithOwnerIds.length })}
              >
                <CustomerShares
                  customer={display}
                  owners={owners}
                  onAdd={(userId) =>
                    void runAction(() => mutations.share.mutateAsync({ id: display.id, userId }))
                  }
                  onRemove={(userId) =>
                    void runAction(() => mutations.unshare.mutateAsync({ id: display.id, userId }))
                  }
                />
              </Accordion>
            ) : null}

            {!editing && display.tags.length ? (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {display.tags.map((tag) => (
                  <span
                    className="rounded-[5px] bg-[#eef3fa] px-1.5 py-0.5 text-[10px] font-medium text-[#516078]"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

          </div>
        ) : null}

        {tab === "activity" ? (
          <div
            className="flex min-h-0 flex-1 flex-col"
            key="activity"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <CustomerActivityTab customer={display} />
          </div>
        ) : null}

        {tab === "quotes" ? (
          <div
            className="flex min-h-0 flex-1 flex-col"
            key="quotes"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <CustomerQuotesTab
              canCreate={canCreateQuote}
              customer={display}
              onNewQuote={() =>
                router.push(
                  `/devis?create=1&customer=${encodeURIComponent(display.id)}&name=${encodeURIComponent(display.displayName)}`,
                )
              }
            />
          </div>
        ) : null}

        {tab === "invoices" ? (
          <div
            className="flex min-h-0 flex-1 flex-col"
            key="invoices"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <CustomerInvoicesTab
              canCreate={canCreateInvoice}
              customer={display}
              onCreateInvoice={() => {
                if (!onPatchCustomer) return;
                const next = createInvoiceFromAcceptedQuote(
                  display,
                  activeOwner?.name ?? "You",
                );
                if (!next) {
                  setError(t("actions.invoiceAcceptedRequired"));
                  return;
                }
                onPatchCustomer(next);
                setNotice(t("historyTabs.invoiceCreatedToast"));
              }}
            />
          </div>
        ) : null}

        {tab === "payments" ? (
          <div
            className="flex min-h-0 flex-1 flex-col"
            key="payments"
            style={{ animation: "compte-tab-in 160ms ease-out" }}
          >
            <CustomerPaymentsTab
              canRecord={canRecordPayment}
              customer={display}
              onRecordPayment={() => {
                if (!onPatchCustomer) return;
                const next = recordMockPayment(display, activeOwner?.name ?? "You");
                if (!next) {
                  setError(t("actions.paymentHint"));
                  return;
                }
                onPatchCustomer(next);
                setNotice(t("historyTabs.paymentRecordedToast"));
              }}
            />
          </div>
        ) : null}
      </div>

      {confirmCopy && pendingConfirm ? (
        <ConfirmDialog
          body={confirmCopy.body}
          cancelLabel={confirmCopy.cancelLabel}
          confirmLabel={confirmCopy.confirmLabel}
          danger={confirmCopy.danger}
          open
          title={confirmCopy.title}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => {
            const run = pendingConfirm.run;
            setPendingConfirm(null);
            run();
          }}
        />
      ) : null}

      {error ? (
        <SoftToast message={error} tone="error" onDismiss={() => setError("")} />
      ) : null}
      {notice ? (
        <SoftToast message={notice} tone="success" onDismiss={() => setNotice("")} />
      ) : null}
    </section>
  );
}

function CustomerShares({
  customer,
  owners,
  onAdd,
  onRemove,
}: {
  customer: CustomerRecord;
  owners: CustomerOwner[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const t = useTranslations("customers");
  const candidates = owners.filter(
    (owner) => owner.id !== customer.ownerId && !customer.sharedWithOwnerIds.includes(owner.id),
  );

  return (
    <div className="space-y-2">
      {customer.sharedWith?.length ? (
        <ul className="space-y-1.5">
          {customer.sharedWith.map((user) => (
            <li
              className="flex min-w-0 items-center justify-between gap-2 rounded-[8px] bg-white/65 px-2.5 py-1.5"
              key={user.id}
            >
              <span className="truncate text-xs font-semibold text-[#24334c]" title={user.name}>
                {user.name}
              </span>
              <button
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-[7px] px-2 text-[10px] font-semibold text-[#d1492a] hover:bg-[#fff4f2]"
                type="button"
                onClick={() => onRemove(user.id)}
              >
                <Trash2 aria-hidden="true" className="h-3 w-3" />
                {t("details.removeShare")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-0.5 text-[11px] text-[#7d8aa0]">{t("details.noShares")}</p>
      )}
      {candidates.length ? (
        <label className="block min-w-0">
          <span className="text-[11px] font-medium text-[#7d8aa0]">{t("details.addShare")}</span>
          <select
            className="soft-input mt-1 h-9 w-full rounded-[9px] px-2.5 text-xs text-[#24334c] outline-none focus:ring-[3px] focus:ring-[#044ce2]/20"
            value=""
            onChange={(event) => {
              if (event.target.value) onAdd(event.target.value);
            }}
          >
            <option value="">{t("details.addSharePlaceholder")}</option>
            {candidates.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function TypeToggle({
  value,
  onChange,
}: {
  value: CustomerDraft["type"];
  onChange: (value: CustomerDraft["type"]) => void;
}) {
  const t = useTranslations("customers");
  return (
    <AnimatedSelectionGroup
      className="inline-flex gap-1 rounded-full bg-[#eef3fa] p-1"
      id="customer-type-inline"
    >
      {(["company", "individual"] as const).map((type) => {
        const active = value === type;
        return (
          <button
            className={cn(
              "relative rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
              active ? "text-[#2458d6]" : "text-[#7d8aa0]",
            )}
            key={type}
            onClick={() => onChange(type)}
            type="button"
          >
            {active ? (
              <AnimatedActiveIndicator layoutId="compte-customer-type-inline" variant="soft-pill" />
            ) : null}
            <span className="relative z-[1]">{t(`type.${type}`)}</span>
          </button>
        );
      })}
    </AnimatedSelectionGroup>
  );
}

function QuickAction({
  label,
  icon: Icon,
  href,
  disabled,
  title,
  onClick,
}: {
  label: string;
  icon: typeof Plus;
  href?: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  const className = cn(
    "action-motion soft-button flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-2",
    disabled ? "cursor-not-allowed opacity-45 text-[#66758d]" : "text-[#405069]",
  );

  const content = (
    <>
      <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", !disabled && "text-[#044ce2]")} />
      <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">
        {label}
      </span>
    </>
  );

  if (onClick && !disabled && !href) {
    return (
      <button className={className} title={title} type="button" onClick={onClick}>
        {content}
      </button>
    );
  }

  if (href && !disabled) {
    if (href.startsWith("mailto:")) {
      return (
        <a className={className} href={href} title={title}>
          {content}
        </a>
      );
    }
    return (
      <Link className={className} href={href} title={title}>
        {content}
      </Link>
    );
  }

  return (
    <button className={className} disabled={disabled} title={title} type="button">
      {content}
    </button>
  );
}

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="min-w-0 rounded-[10px] border border-[#e8eef7] bg-white/55 open:pb-2"
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      open={open}
    >
      <summary className="flex h-11 min-w-0 cursor-pointer list-none items-center truncate px-3 text-[11px] font-bold tracking-[0.06em] text-[#98a4b5] uppercase [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="min-w-0 px-3">{children}</div>
    </details>
  );
}

function ViewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-[#7d8aa0]">{label}</dt>
      <dd className="truncate text-xs font-medium text-[#24334c]" title={value}>
        {value}
      </dd>
    </div>
  );
}

function ViewCountryField({
  label,
  code,
  name,
}: {
  label: string;
  code?: string;
  name?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-[#7d8aa0]">{label}</dt>
      <dd className="mt-0.5">
        <CountryFlag className="h-4 w-6" code={code} title={name ?? code ?? "—"} />
      </dd>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  onBlur,
  required,
  className,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  className?: string;
  error?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="text-[11px] font-medium text-[#7d8aa0]">
        {label}
        {required ? <span className="text-[#d1492a]"> *</span> : null}
      </span>
      <input
        aria-invalid={Boolean(error)}
        className={cn(
          "soft-input mt-1 h-9 w-full rounded-[9px] px-2.5 text-xs text-[#24334c] outline-none focus:ring-[3px] focus:ring-[#044ce2]/20",
          error && "ring-1 ring-[#e7a59a]",
        )}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {error ? <p className="mt-1 text-[11px] font-medium text-[#d1492a]">{error}</p> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-medium text-[#7d8aa0]">{label}</span>
      <select
        className="soft-input mt-1 h-9 w-full rounded-[9px] px-2.5 text-xs text-[#24334c] outline-none focus:ring-[3px] focus:ring-[#044ce2]/20"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddressCard({
  label,
  address,
}: {
  label: string;
  address: CustomerRecord["addresses"][number];
}) {
  return (
    <div className="min-w-0 rounded-[8px] bg-white/65 px-2.5 py-1.5 text-[11px] leading-4 text-[#405069]">
      <p className="font-semibold text-[#24334c]">{label}</p>
      <p className="truncate">{address.line1}</p>
      {address.line2 ? <p className="truncate">{address.line2}</p> : null}
      <p className="truncate">
        {address.postalCode} {address.city}
      </p>
      <div className="mt-0.5">
        <CountryFlag
          className="h-3.5 w-5"
          code={address.countryCode}
          title={address.country}
        />
      </div>
    </div>
  );
}
