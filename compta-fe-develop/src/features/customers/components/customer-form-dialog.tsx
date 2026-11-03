"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  AnimatedActiveIndicator,
  AnimatedSelectionGroup,
} from "@/components/compte/animated-selection";
import { SoftToast } from "@/components/compte/soft-toast";
import { FormSheet } from "@/components/forms/form-sheet";
import { useApiErrorMessage } from "@/lib/api/use-api-error";
import { useSubmitLock } from "@/lib/use-submit-lock";
import { cn } from "@/lib/utils";

import { CountrySelectField } from "./country-select-field";
import { PhoneInputField } from "./phone-input-field";

import {
  canSaveCustomerDraft,
  getCustomerDraftSaveIssues,
  initialCustomerDraft,
  type CustomerDraft,
  type CustomerDraftSaveField,
} from "../customer-draft";
import { AVAILABLE_TAGS } from "../mocks/customers";
import { customerFieldErrors, type CustomerFieldErrors } from "../services/customers-adapter";
import { useCustomerMutations } from "../services/customers-service";
import { isOptionalSiretValid } from "../services/siret-lookup";
import type { CustomerOwner, CustomerPaymentTerms, CustomerRecord, PaymentMethod } from "../types";

function saveIssueMessage(
  t: ReturnType<typeof useTranslations<"customers">>,
  field: CustomerDraftSaveField,
) {
  switch (field) {
    case "displayName":
      return t("form.requiredName");
    case "email":
      return t("form.requiredEmail");
    case "website":
      return t("form.invalidWebsite");
    case "billingLine1":
    case "billingPostalCode":
    case "billingCity":
      return t("form.requiredAddress");
  }
}

/** Create-only customer sheet. Edit happens inline in CustomerDetailsPanel. */
export function CustomerFormDialog({
  open,
  owners,
  defaultOwnerId,
  onClose,
  onCreated,
  onDuplicateFound,
}: {
  open: boolean;
  owners: CustomerOwner[];
  defaultOwnerId: string;
  onClose: () => void;
  onCreated: (customer: CustomerRecord) => void;
  onDuplicateFound: (draft: CustomerDraft, resume: () => void) => void;
}) {
  const t = useTranslations("customers");
  const { message, fieldMessage } = useApiErrorMessage();
  const { create } = useCustomerMutations();
  const lock = useSubmitLock();
  const [draft, setDraft] = useState<CustomerDraft>(() => initialCustomerDraft(defaultOwnerId));
  const [siretTouched, setSiretTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<CustomerFieldErrors>({});
  const [error, setError] = useState("");
  const [invalidFields, setInvalidFields] = useState<CustomerDraftSaveField[]>([]);

  const canSave = useMemo(() => canSaveCustomerDraft(draft), [draft]);

  function patch(partial: Partial<CustomerDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setServerErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(partial)) delete next[key as keyof CustomerDraft];
      return next;
    });
    setInvalidFields((current) =>
      current.filter((field) => {
        if (field in partial) return false;
        return true;
      }),
    );
  }

  function focusFirstInvalid(fields: CustomerDraftSaveField[]) {
    const first = fields[0];
    if (!first) return;
    window.requestAnimationFrame(() => {
      const node = document.getElementById(`customer-field-${first}`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (node instanceof HTMLInputElement) node.focus({ preventScroll: true });
    });
  }

  async function handleSave(force = false) {
    if (draft.type === "company" && !isOptionalSiretValid(draft.siret)) {
      setSiretTouched(true);
      setError(t("form.siretError"));
      return;
    }
    const issues = getCustomerDraftSaveIssues(draft);
    if (issues.length > 0) {
      setInvalidFields(issues);
      setError(saveIssueMessage(t, issues[0]));
      focusFirstInvalid(issues);
      return;
    }
    if (!force) {
      onDuplicateFound(draft, () => void handleSave(true));
      return;
    }
    await lock(async () => {
      try {
        const created = await create.mutateAsync(draft);
        setDraft(initialCustomerDraft(defaultOwnerId));
        setError("");
        setInvalidFields([]);
        setServerErrors({});
        onClose();
        onCreated(created);
      } catch (caught) {
        setServerErrors(customerFieldErrors(caught, fieldMessage));
        setError(message(caught));
      }
    });
  }

  return (
    <FormSheet
      closeLabel={t("form.cancel")}
      description={t("form.body")}
      open={open}
      title={t("form.title")}
      widthClassName="sm:max-w-[520px]"
      zIndexClassName="z-[70]"
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-2 sm:items-end">
          {!canSave ? (
            <p className="w-full text-left text-xs font-medium text-[#c46b12] sm:text-right">
              {t("form.requiredHint")}
            </p>
          ) : null}
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              className="action-motion soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#516078]"
              onClick={onClose}
              type="button"
            >
              {t("form.cancel")}
            </button>
            <button
              className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
              disabled={create.isPending}
              onClick={() => void handleSave(false)}
              type="button"
            >
              {create.isPending ? t("details.saving") : t("form.save")}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <section>
          <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
            {t("form.type")}
          </p>
          <AnimatedSelectionGroup
            className="mt-2 inline-flex gap-1 rounded-full bg-[#eef3fa] p-1"
            id="customer-type"
          >
            {(["company", "individual"] as const).map((type) => {
              const active = draft.type === type;
              return (
                <button
                  className={cn(
                    "relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    active ? "text-[#2458d6]" : "text-[#7d8aa0]",
                  )}
                  key={type}
                  onClick={() => {
                    patch({ type });
                  }}
                  type="button"
                >
                  {active ? (
                    <AnimatedActiveIndicator
                      layoutId="compte-customer-type-active"
                      variant="soft-pill"
                    />
                  ) : null}
                  <span className="relative z-[1]">{t(`type.${type}`)}</span>
                </button>
              );
            })}
          </AnimatedSelectionGroup>
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
            {t("sections.identity")}
          </p>
          <Field
            error={
              invalidFields.includes("displayName")
                ? t("form.requiredName")
                : serverErrors.displayName
            }
            id="customer-field-displayName"
            label={draft.type === "company" ? t("fields.displayName") : t("fields.fullName")}
            onChange={(value) => patch({ displayName: value })}
            required
            value={draft.displayName}
          />
          {draft.type === "company" ? (
            <>
              <Field
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
              <Field
                error={serverErrors.vatNumber}
                label={t("fields.vat")}
                onChange={(value) => patch({ vatNumber: value })}
                value={draft.vatNumber}
              />
            </>
          ) : null}
          <Field
            error={invalidFields.includes("email") ? t("form.requiredEmail") : serverErrors.email}
            id="customer-field-email"
            label={t("fields.email")}
            onChange={(value) => patch({ email: value })}
            value={draft.email}
          />
          <PhoneInputField
            label={t("fields.phone")}
            onChange={(value) => patch({ phone: value })}
            value={draft.phone}
          />
          <Field
            error={invalidFields.includes("website") ? t("form.invalidWebsite") : serverErrors.website}
            id="customer-field-website"
            label={t("fields.website")}
            onChange={(value) => patch({ website: value })}
            value={draft.website}
          />
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
            {t("sections.contacts", { count: 1 })}
          </p>
          <Field
            error={serverErrors.contactName}
            label={t("fields.contactName")}
            onChange={(value) => patch({ contactName: value })}
            value={draft.contactName}
          />
          <Field
            error={serverErrors.contactEmail}
            label={t("fields.contactEmail")}
            onChange={(value) => patch({ contactEmail: value })}
            value={draft.contactEmail}
          />
          <PhoneInputField
            label={t("fields.contactPhone")}
            onChange={(value) => patch({ contactPhone: value })}
            value={draft.contactPhone}
          />
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
            {t("address.billing")}
          </p>
          <Field
            error={
              invalidFields.includes("billingLine1")
                ? t("form.requiredAddress")
                : serverErrors.billingLine1
            }
            id="customer-field-billingLine1"
            label={t("fields.line1")}
            onChange={(value) => patch({ billingLine1: value })}
            required
            value={draft.billingLine1}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              error={
                invalidFields.includes("billingPostalCode")
                  ? t("form.requiredAddress")
                  : serverErrors.billingPostalCode
              }
              id="customer-field-billingPostalCode"
              label={t("fields.postalCode")}
              onChange={(value) => patch({ billingPostalCode: value })}
              required
              value={draft.billingPostalCode}
            />
            <Field
              error={
                invalidFields.includes("billingCity")
                  ? t("form.requiredAddress")
                  : serverErrors.billingCity
              }
              id="customer-field-billingCity"
              label={t("fields.city")}
              onChange={(value) => patch({ billingCity: value })}
              required
              value={draft.billingCity}
            />
          </div>
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
          <label className="flex items-center gap-2 text-xs text-[#516078]">
            <input
              checked={draft.useBillingForDelivery}
              className="accent-[#044ce2]"
              onChange={(event) => patch({ useBillingForDelivery: event.target.checked })}
              type="checkbox"
            />
            {t("form.useBillingForDelivery")}
          </label>
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[#98a4b5] uppercase">
            {t("sections.commercial")}
          </p>
          <SelectField
            label={t("fields.paymentTerms")}
            onChange={(value) => patch({ paymentTerms: value as CustomerPaymentTerms })}
            options={["net_15", "net_30", "net_45", "net_60", "upon_receipt"].map((value) => ({
              value,
              label: t(`terms.${value}`),
            }))}
            value={draft.paymentTerms}
          />
          <SelectField
            label={t("fields.paymentMethod")}
            onChange={(value) => patch({ paymentMethod: value as PaymentMethod })}
            options={["transfer", "check", "card", "direct_debit"].map((value) => ({
              value,
              label: t(`methods.${value}`),
            }))}
            value={draft.paymentMethod}
          />
          <SelectField
            label={t("fields.owner")}
            onChange={(value) => patch({ ownerId: value })}
            options={owners.map((owner) => ({ value: owner.id, label: owner.name }))}
            value={draft.ownerId}
          />
          <p className="text-[11px] leading-5 text-[#7d8aa0]">{t("form.ownerHint")}</p>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_TAGS.filter((tag) => tag !== "Duplicate").map((tag) => {
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
        </section>

      </div>

      {error ? (
        <SoftToast message={error} tone="error" onDismiss={() => setError("")} />
      ) : null}
    </FormSheet>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  required = false,
  error,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="text-[11px] font-medium text-[#7d8aa0]">
        {label}
        {required ? <span className="ml-0.5 text-[#d1492a]">*</span> : null}
      </span>
      <input
        aria-invalid={Boolean(error)}
        className={cn(
          "soft-input mt-1 min-h-10 w-full rounded-[10px] px-3 text-sm text-[#24334c] outline-none",
          error && "ring-1 ring-[#e7a59a]",
        )}
        id={id}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {error ? <p className="mt-1 text-xs font-medium text-[#d1492a]">{error}</p> : null}
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
    <label className="block">
      <span className="text-[11px] font-medium text-[#7d8aa0]">{label}</span>
      <select
        className="soft-input mt-1 min-h-10 w-full rounded-[10px] px-3 text-sm text-[#24334c] outline-none"
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
