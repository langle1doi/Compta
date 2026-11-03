"use client";

import { useRouter } from "@/i18n/navigation";
import { FormSheet } from "@/components/forms/form-sheet";
import { can } from "@/features/settings/can";
import { usePermissions } from "@/features/settings/session-provider";
import { SoftDatePicker } from "@/components/compte/soft-date-picker";
import { TextField } from "@/components/forms/text-field";
import { owners } from "@/features/quotes/seed";
import { addCustomer, addQuote } from "@/features/quotes/store";
import { ledgerToday, type CustomerRecord } from "@/features/quotes/model";
import { useTranslations } from "next-intl";
import { addMonthsToIso } from "@/lib/iso-date";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export function QuoteCreateDialog({
  customers,
  forceNewCustomer,
  initialCustomerId,
  onClose,
  onCreated,
}: {
  customers: CustomerRecord[];
  forceNewCustomer: boolean;
  initialCustomerId?: string | null;
  onClose: () => void;
  onCreated?: (quote: import("./model").QuoteRecord, customer: CustomerRecord) => void;
}) {
  const t = useTranslations("register.create");
  const shell = useTranslations("register");
  const router = useRouter();
  const activePermissions = usePermissions();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const preset = initialCustomerId
    ? customers.find((customer) => customer.id === initialCustomerId)
    : undefined;
  const [query, setQuery] = useState(preset?.name ?? "");
  const [customerId, setCustomerId] = useState(preset?.id ?? "");
  const [boundCustomerId, setBoundCustomerId] = useState(preset?.id ?? "");
  const [validUntil, setValidUntil] = useState(() => addMonthsToIso(ledgerToday, 2));
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [openList, setOpenList] = useState(forceNewCustomer && !preset);
  const [errors, setErrors] = useState<{ customer?: string; validity?: string; owner?: string }>({});

  if (preset && preset.id !== boundCustomerId) {
    setBoundCustomerId(preset.id);
    setCustomerId(preset.id);
    setQuery(preset.name);
    setOpenList(false);
  }

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customers.filter((customer) => customer.name.toLowerCase().includes(needle)).slice(0, 6);
  }, [customers, query]);

  const canCreate =
    can(activePermissions, "customer.create") &&
    query.trim().length > 1 &&
    !matches.some((customer) => customer.name.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    if (preset) return;
    inputRef.current?.focus();
  }, [preset]);

  function submit() {
    const nextErrors: typeof errors = {};
    if (!customerId && !(canCreate && query.trim())) nextErrors.customer = t("customerRequired");
    if (!validUntil) nextErrors.validity = t("validityRequired");
    if (!ownerId) nextErrors.owner = t("ownerRequired");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const customer = customerId
      ? customers.find((item) => item.id === customerId)
      : addCustomer(query.trim());
    if (!customer) {
      setErrors({ customer: t("customerRequired") });
      return;
    }
    const quote = addQuote({
      customerId: customer.id,
      ownerId,
      validUntil,
    });
    onCreated?.(quote, customer);
    onClose();
    if (!onCreated) {
      router.push(`/devis/${quote.id}`);
    }
  }

  return (
    <FormSheet
      closeLabel={shell("cancel")}
      description={t("body")}
      open
      title={t("title")}
      widthClassName="sm:max-w-[440px]"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            type="button"
            onClick={onClose}
          >
            {shell("cancel")}
          </button>
          <button
            className="soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
            type="button"
            onClick={submit}
          >
            {t("submit")}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[#7a899e] uppercase">
            {t("customer")}
          </h3>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]" htmlFor="quote-customer">
              {t("customer")}
              <span className="text-[#8e2a26]"> *</span>
            </label>
            <input
              ref={inputRef}
              id="quote-customer"
              role="combobox"
              aria-expanded={openList}
              aria-controls={listId}
              aria-invalid={errors.customer ? true : undefined}
              aria-describedby={errors.customer ? "quote-customer-error" : undefined}
              className={`h-10 w-full rounded-[10px] border bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30 ${
                errors.customer ? "border-[#c9564f]" : "border-[#dfe6f1]"
              }`}
              placeholder={t("customerPlaceholder")}
              value={query}
              onFocus={() => setOpenList(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setCustomerId("");
                setOpenList(true);
              }}
            />
            {openList ? (
              <ul
                id={listId}
                role="listbox"
                className="mt-1 overflow-hidden rounded-[12px] border border-[#e1e7f1] bg-white"
              >
                {matches.map((customer) => (
                  <li key={customer.id}>
                    <button
                      className="flex min-h-10 w-full items-center px-3 text-left text-sm text-[#24334c] hover:bg-[#f4f8ff]"
                      type="button"
                      onClick={() => {
                        setCustomerId(customer.id);
                        setQuery(customer.name);
                        setOpenList(false);
                      }}
                    >
                      {customer.name}
                    </button>
                  </li>
                ))}
                {canCreate ? (
                  <li>
                    <button
                      className="flex min-h-10 w-full items-center px-3 text-left text-sm font-medium text-[#044ce2] hover:bg-[#f4f8ff]"
                      type="button"
                      onClick={() => setOpenList(false)}
                    >
                      {t("createCustomer", { name: query.trim() })}
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {errors.customer ? (
              <span id="quote-customer-error" className="mt-1.5 block text-xs text-[#8e2a26]">
                {errors.customer}
              </span>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[#7a899e] uppercase">
            {t("validity")}
          </h3>
          <div>
            <SoftDatePicker
              label={t("validity")}
              required
              triggerClassName="!h-10 rounded-[10px] px-3 text-sm"
              value={validUntil}
              onChange={setValidUntil}
            />
            {errors.validity ? (
              <p className="mt-1.5 text-[11px] text-[#c9564f]">{errors.validity}</p>
            ) : null}
          </div>
          <label className="block" htmlFor="quote-owner">
            <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
              {t("owner")}
              <span className="text-[#8e2a26]"> *</span>
            </span>
            <select
              id="quote-owner"
              className="h-10 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>
    </FormSheet>
  );
}
