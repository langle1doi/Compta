"use client";

import { Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
  TOP_TABS_ACTIVE_LAYOUT_ID,
} from "@/components/compte/animated-selection";
import { AmountInput } from "@/components/compte/amount-input";
import { SoftSelect } from "@/components/compte/soft-select";
import { IconTile, StatusBadge } from "@/components/dashboard/tone";
import { formatMoneyFromCents, parseAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

import { productIconMap, productIconTone } from "../icons";
import {
  marginCents,
  marginRatio,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  PRODUCT_VAT_RATES,
  type CustomerProductPrice,
  type ProductActivity,
  type ProductDraftInput,
  type ProductRecord,
  type ProductUsageLink,
} from "../model";

const tabs = ["details", "pricing", "usage", "activity"] as const;
type PanelTab = (typeof tabs)[number];

type CustomerOption = { id: string; name: string };

export function ProductDetailsPanel({
  product,
  prices,
  usage,
  activities,
  customers,
  canUpdate,
  mode,
  onClose,
  onEdit,
  onCancelEdit,
  onSave,
  onDeactivate,
  onActivate,
  onAddPrice,
  onRemovePrice,
}: {
  product: ProductRecord;
  prices: CustomerProductPrice[];
  usage: ProductUsageLink[];
  activities: ProductActivity[];
  customers: CustomerOption[];
  canUpdate: boolean;
  mode: "view" | "edit";
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: Partial<ProductDraftInput>) => { ok: boolean; error?: string };
  onDeactivate: () => void;
  onActivate: () => void;
  onAddPrice: (customerId: string, unitPriceCents: number) => { ok: boolean; error?: string };
  onRemovePrice: (priceId: string) => void;
}) {
  const t = useTranslations("products");
  const locale = useLocale();
  const [tab, setTab] = useState<PanelTab>("details");
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [code, setCode] = useState(product.code);
  const [type, setType] = useState(product.type);
  const [unit, setUnit] = useState(product.unit);
  const [unitPrice, setUnitPrice] = useState(String(product.unitPriceCents / 100));
  const [cost, setCost] = useState(String(product.costCents / 100));
  const [vatRate, setVatRate] = useState(String(product.vatRate));
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [status, setStatus] = useState(product.status);
  const [error, setError] = useState<string | null>(null);
  const [priceCustomerId, setPriceCustomerId] = useState(customers[0]?.id ?? "");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);

  const Icon = productIconMap[product.iconKey];
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [locale],
  );
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [locale],
  );

  const pricedCustomerIds = new Set(prices.map((item) => item.customerId));
  const availableCustomers = customers.filter((item) => !pricedCustomerIds.has(item.id));

  function submitEdit() {
    const unitPriceCents = Math.round(parseAmount(unitPrice) * 100);
    const costCents = Math.round(parseAmount(cost) * 100);
    if (!name.trim() || !code.trim()) {
      setError(t("form.required"));
      return;
    }
    if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
      setError(t("form.invalidPrice"));
      return;
    }
    if (!Number.isFinite(costCents) || costCents < 0) {
      setError(t("form.invalidCost"));
      return;
    }
    const result = onSave({
      name,
      description,
      code,
      type,
      unit,
      unitPriceCents,
      costCents,
      vatRate: Number(vatRate),
      categoryId,
      status,
    });
    if (!result.ok) {
      setError(
        result.error === "duplicate_code" ? t("form.duplicateCode") : t("form.failed"),
      );
      return;
    }
    setError(null);
  }

  function submitPrice() {
    const cents = Math.round(parseAmount(priceAmount) * 100);
    if (!priceCustomerId) {
      setPriceError(t("pricing.pickCustomer"));
      return;
    }
    if (!Number.isFinite(cents) || cents < 0) {
      setPriceError(t("form.invalidPrice"));
      return;
    }
    const result = onAddPrice(priceCustomerId, cents);
    if (!result.ok) {
      setPriceError(t("form.failed"));
      return;
    }
    setPriceAmount("");
    setPriceError(null);
    setPriceCustomerId(availableCustomers.find((item) => item.id !== priceCustomerId)?.id ?? "");
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 shrink-0 bg-white/95 backdrop-blur-sm">
        <header className="border-b border-[#edf2f8] px-3.5 py-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5 pt-0.5">
              <IconTile
                icon={Icon}
                size="md"
                strokeWidth={2.1}
                tone={productIconTone[product.iconKey]}
              />
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-[#063586]">
                  {product.name}
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-[#7d8aa0]">
                  {t(`type.${product.type}`)} · {t(`status.${product.status}`)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {mode === "edit" ? (
                <>
                  <button
                    className="action-motion soft-button inline-flex h-8 items-center rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
                    type="button"
                    onClick={onCancelEdit}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="action-motion soft-primary inline-flex h-8 items-center rounded-[8px] px-2.5 text-[11px] font-semibold text-white"
                    type="button"
                    onClick={submitEdit}
                  >
                    {t("saveChanges")}
                  </button>
                </>
              ) : null}
              <button
                aria-label={t("close")}
                className="action-motion soft-button grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#66758d]"
                type="button"
                onClick={onClose}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
          {canUpdate && mode === "view" ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#044ce2]"
                type="button"
                onClick={onEdit}
              >
                {t("editAction")}
              </button>
              {product.status === "active" ? (
                <button
                  className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#516078]"
                  type="button"
                  onClick={onDeactivate}
                >
                  {t("deactivate")}
                </button>
              ) : (
                <button
                  className="action-motion soft-button h-8 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#044ce2]"
                  type="button"
                  onClick={onActivate}
                >
                  {t("activate")}
                </button>
              )}
            </div>
          ) : null}
        </header>

        {mode === "view" ? (
          <AnimatedSelectionGroup className="min-w-0 border-b border-[#edf2f8] px-1.5" id="product-detail-tabs">
            <div
              aria-label={t("panel.tabsLabel")}
              className="flex min-w-0 gap-0.5 overflow-x-auto py-1.5"
              role="tablist"
            >
              {tabs.map((item) => {
                const active = tab === item;
                return (
                  <button
                    aria-selected={active}
                    className={cn(
                      "relative min-w-0 flex-1 truncate rounded-full px-1.5 py-2 text-[11px] font-semibold transition-colors",
                      active ? "text-[#2458d6]" : "text-[#7d8aa0] hover:text-[#405069]",
                    )}
                    key={item}
                    role="tab"
                    type="button"
                    onClick={() => setTab(item)}
                  >
                    {active ? (
                      <AnimatedActiveIndicator
                        className="rounded-full"
                        layoutId={`${TOP_TABS_ACTIVE_LAYOUT_ID}-product-details`}
                        variant="soft-pill"
                      />
                    ) : null}
                    <span className="relative z-[1] truncate">{t(`tabsPanel.${item}`)}</span>
                  </button>
                );
              })}
            </div>
          </AnimatedSelectionGroup>
        ) : null}
      </div>

      <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        {mode === "edit" ? (
          <div className="space-y-3">
            <p className="text-[11px] text-[#7d8aa0]">{t("form.priceFutureOnly")}</p>
            <Field label={`${t("fields.name")} *`}>
              <input
                className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label={`${t("fields.code")} *`}>
              <input
                className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </Field>
            <Field label={t("fields.description")}>
              <textarea
                className="soft-input mt-1 min-h-[72px] w-full rounded-[9px] px-3 py-2 text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <SoftSelect
              label={t("fields.type")}
              options={[
                { value: "good", label: t("type.good") },
                { value: "service", label: t("type.service") },
              ]}
              value={type}
              onChange={(value) => setType(value as ProductRecord["type"])}
            />
            <SoftSelect
              label={t("fields.category")}
              options={PRODUCT_CATEGORIES.map((id) => ({
                value: id,
                label: t(`categories.${id}`),
              }))}
              value={categoryId}
              onChange={(value) => setCategoryId(value as ProductRecord["categoryId"])}
            />
            <SoftSelect
              label={t("fields.unit")}
              options={PRODUCT_UNITS.map((id) => ({
                value: id,
                label: t(`units.${id}`),
              }))}
              value={unit}
              onChange={(value) => setUnit(value as ProductRecord["unit"])}
            />
            <Field label={`${t("fields.unitPrice")} *`}>
              <AmountInput
                className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c]"
                placeholder="0,00"
                value={unitPrice}
                onValueChange={setUnitPrice}
              />
            </Field>
            <Field label={t("fields.cost")}>
              <AmountInput
                className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c]"
                placeholder="0,00"
                value={cost}
                onValueChange={setCost}
              />
            </Field>
            <SoftSelect
              label={t("fields.vat")}
              options={PRODUCT_VAT_RATES.map((rate) => ({
                value: String(rate),
                label: `${rate}%`,
              }))}
              value={vatRate}
              onChange={setVatRate}
            />
            <SoftSelect
              label={t("fields.status")}
              options={[
                { value: "active", label: t("status.active") },
                { value: "inactive", label: t("status.inactive") },
              ]}
              value={status}
              onChange={(value) => setStatus(value as ProductRecord["status"])}
            />
            {error ? <p className="text-xs font-medium text-[#c9564f]">{error}</p> : null}
          </div>
        ) : null}

        {mode === "view" && tab === "details" ? (
          <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            <Section title={t("sections.basic")}>
              <Row label={t("fields.name")} value={product.name} />
              <Row label={t("fields.description")} value={product.description || "—"} />
              <Row label={t("fields.code")} value={product.code} />
              <Row label={t("fields.type")} value={t(`type.${product.type}`)} />
              <Row label={t("fields.category")} value={t(`categories.${product.categoryId}`)} />
              <Row label={t("fields.unit")} value={t(`units.${product.unit}`)} />
              <Row
                label={t("fields.status")}
                value={
                  <StatusBadge size="xs" tone={product.status === "active" ? "green" : "slate"}>
                    {t(`status.${product.status}`)}
                  </StatusBadge>
                }
              />
            </Section>
            <Section title={t("sections.pricing")}>
              <Row
                label={t("fields.unitPrice")}
                value={`${formatMoneyFromCents(product.unitPriceCents)} / ${t(`units.${product.unit}`)}`}
              />
              <Row label={t("fields.cost")} value={formatMoneyFromCents(product.costCents)} />
              <Row label={t("fields.vat")} value={`${product.vatRate}%`} />
              <Row label={t("fields.margin")} value={formatMoneyFromCents(marginCents(product))} />
              <Row
                label={t("fields.marginPct")}
                value={`${Math.round(marginRatio(product) * 1000) / 10}%`}
              />
            </Section>
            <Section title={t("sections.timestamps")}>
              <Row label={t("fields.createdBy")} value={product.createdBy} />
              <Row label={t("fields.createdAt")} value={dateTime.format(new Date(product.createdAt))} />
              <Row label={t("fields.updatedAt")} value={dateTime.format(new Date(product.updatedAt))} />
            </Section>
          </div>
        ) : null}

        {mode === "view" && tab === "pricing" ? (
          <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            <Section title={t("pricing.default")}>
              <Row
                label={t("fields.unitPrice")}
                value={`${formatMoneyFromCents(product.unitPriceCents)} / ${t(`units.${product.unit}`)}`}
              />
            </Section>
            <Section title={t("pricing.customer")}>
              {prices.length === 0 ? (
                <p className="text-xs text-[#7d8aa0]">{t("pricing.empty")}</p>
              ) : (
                <ul className="space-y-2">
                  {prices.map((price) => {
                    const customer = customers.find((item) => item.id === price.customerId);
                    return (
                      <li
                        className="flex items-center justify-between gap-2 rounded-[8px] border border-[#edf2f8] px-2.5 py-2"
                        key={price.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#24334c]">
                            {customer?.name ?? price.customerId}
                          </p>
                          <p className="tabular-nums text-[11px] text-[#7d8aa0]">
                            {formatMoneyFromCents(price.unitPriceCents)} / {t(`units.${product.unit}`)}
                          </p>
                        </div>
                        {canUpdate ? (
                          <button
                            className="action-motion soft-button h-7 rounded-[8px] px-2 text-[11px] font-semibold text-[#c9564f]"
                            type="button"
                            onClick={() => onRemovePrice(price.id)}
                          >
                            {t("pricing.remove")}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canUpdate && availableCustomers.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-[#edf2f8] pt-3">
                  <p className="text-[11px] font-semibold text-[#66758d]">{t("pricing.add")}</p>
                  <SoftSelect
                    label={t("pricing.customerField")}
                    options={availableCustomers.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                    value={priceCustomerId || availableCustomers[0]?.id || ""}
                    onChange={setPriceCustomerId}
                  />
                  <Field label={t("fields.unitPrice")}>
                    <AmountInput
                      className="soft-input mt-1 h-10 w-full rounded-[9px] px-3 text-sm text-[#24334c]"
                      placeholder="0,00"
                      value={priceAmount}
                      onValueChange={setPriceAmount}
                    />
                  </Field>
                  {priceError ? (
                    <p className="text-xs font-medium text-[#c9564f]">{priceError}</p>
                  ) : null}
                  <button
                    className="action-motion soft-primary inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-xs font-semibold text-white"
                    type="button"
                    onClick={submitPrice}
                  >
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                    {t("pricing.save")}
                  </button>
                </div>
              ) : null}
            </Section>
          </div>
        ) : null}

        {mode === "view" && tab === "usage" ? (
          <div className="space-y-3" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            {usage.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#7d8aa0]">{t("usage.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {usage.map((item) => (
                  <li
                    className="rounded-[10px] border border-[#edf2f8] px-3 py-2.5"
                    key={item.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#24334c]">
                          {item.documentNumber}
                        </p>
                        <p className="dashboard-list__secondary">{item.customerName}</p>
                        <p className="dashboard-list__secondary">
                          {dateFmt.format(new Date(`${item.date}T00:00:00`))} ·{" "}
                          {t(`usage.${item.documentKind}`)} · {item.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="dashboard-list__amount">
                          {formatMoneyFromCents(item.amountCents)}
                        </p>
                        <p className="dashboard-list__secondary tabular-nums">
                          {item.quantity} × {formatMoneyFromCents(item.unitPriceCents)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {mode === "view" && tab === "activity" ? (
          <ol className="space-y-2 py-1" style={{ animation: "compte-tab-in 160ms ease-out" }}>
            {activities.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#7d8aa0]">{t("activity.empty")}</p>
            ) : (
              activities.map((item) => (
                <li className="rounded-[10px] border border-[#edf2f8] px-3 py-2.5" key={item.id}>
                  <p className="text-xs font-semibold text-[#24334c]">
                    {t(`activity.${item.kind}`, {
                      detail: item.description ? ` — ${item.description}` : "",
                    })}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#7d8aa0]">
                    {dateTime.format(new Date(item.at))} · {item.actorName}
                  </p>
                </li>
              ))
            )}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-[#edf2f8] px-3 py-3">
      <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">{title}</p>
      <dl className="mt-2 space-y-1.5 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <dt className="shrink-0 text-[11px] text-[#7d8aa0]">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-medium text-[#24334c]">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[#66758d]">{label}</span>
      {children}
    </label>
  );
}
