"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { SoftDatePicker } from "@/components/compte/soft-date-picker";
import { FormSheet } from "@/components/forms/form-sheet";
import { seedCustomers } from "@/features/quotes/seed";
import { mockCompanies } from "@/features/settings/mocks/companies";

import { createProject } from "../store";
import { CustomerCombobox } from "./customer-combobox";

/**
 * Project status on create defaults to Active (FE domain assumption —
 * PRD does not define an explicit lifecycle). Status is not shown in the
 * create form to keep creation focused on the project container only.
 */
export function NewProjectSheet({
  open,
  companyId,
  onClose,
  onCreated,
}: {
  open: boolean;
  companyId: string;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const t = useTranslations("projects");
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    customer?: string;
    dates?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  const companyName =
    mockCompanies.find((company) => company.id === companyId)?.name ?? companyId;

  const customerOptions = useMemo(
    () =>
      seedCustomers.map((customer) => ({
        value: customer.id,
        label: customer.name,
      })),
    [],
  );

  function validate() {
    const next: typeof fieldErrors = {};
    if (!name.trim()) next.name = t("form.nameRequired");
    if (!customerId) next.customer = t("form.customerRequired");
    if (startDate && endDate && endDate < startDate) {
      next.dates = t("form.dateOrder");
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const customer = seedCustomers.find((item) => item.id === customerId);
      const project = createProject({
        name: name.trim(),
        customerId,
        customerName: customer?.name ?? customerId,
        companyId,
        description: description.trim(),
        status: "active",
        startDate: startDate || null,
        endDate: endDate || null,
      });
      onCreated(project.id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormSheet
      open={open}
      title={t("form.createTitle")}
      description={t("form.createDescription")}
      closeLabel={t("form.close")}
      widthClassName="w-full sm:w-[min(100%,480px)] sm:max-w-[480px]"
      zIndexClassName="z-[70]"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
            disabled={submitting}
            type="button"
            onClick={onClose}
          >
            {t("form.cancel")}
          </button>
          <button
            className="action-motion soft-primary h-9 rounded-[9px] px-3 text-xs font-semibold text-white disabled:opacity-60"
            disabled={submitting}
            type="button"
            onClick={submit}
          >
            {submitting ? t("form.creating") : t("form.create")}
          </button>
        </div>
      }
    >
      <div className="space-y-5 px-1 py-1">
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98a4b5]">
            {t("form.sectionInfo")}
          </h3>
          <Field
            error={fieldErrors.name}
            label={`${t("form.name")} *`}
          >
            <input
              className="h-9 w-full rounded-[9px] border border-[#e1e7f1] px-2.5 text-xs outline-none focus:border-[#044ce2]"
              maxLength={120}
              placeholder={t("form.namePlaceholder")}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                }
              }}
            />
          </Field>

          <div>
            <CustomerCombobox
              emptyLabel={t("form.customerEmpty")}
              label={`${t("form.customer")} *`}
              options={customerOptions}
              placeholder={t("form.selectCustomer")}
              searchPlaceholder={t("form.searchCustomer")}
              value={customerId}
              onChange={(next) => {
                setCustomerId(next);
                if (fieldErrors.customer) {
                  setFieldErrors((current) => ({
                    ...current,
                    customer: undefined,
                  }));
                }
              }}
            />
            {fieldErrors.customer ? (
              <p className="mt-1 text-[11px] text-[#c9564f]">{fieldErrors.customer}</p>
            ) : null}
          </div>

          <p className="rounded-[9px] bg-[#f8fafc] px-2.5 py-2 text-[11px] text-[#7d8aa0]">
            <span className="font-semibold text-[#516078]">{t("form.company")}: </span>
            {companyName}
          </p>

          <Field label={t("form.description")}>
            <textarea
              className="min-h-[72px] w-full rounded-[9px] border border-[#e1e7f1] px-2.5 py-2 text-xs outline-none focus:border-[#044ce2]"
              placeholder={t("form.descriptionPlaceholder")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98a4b5]">
            {t("form.sectionDates")}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SoftDatePicker
              label={t("form.startDate")}
              max={endDate || undefined}
              value={startDate}
              onChange={(next) => {
                setStartDate(next);
                if (fieldErrors.dates) {
                  setFieldErrors((current) => ({ ...current, dates: undefined }));
                }
              }}
            />
            <SoftDatePicker
              label={t("form.endDate")}
              min={startDate || undefined}
              value={endDate}
              onChange={(next) => {
                setEndDate(next);
                if (fieldErrors.dates) {
                  setFieldErrors((current) => ({ ...current, dates: undefined }));
                }
              }}
            />
          </div>
          {fieldErrors.dates ? (
            <p className="text-[11px] text-[#c9564f]">{fieldErrors.dates}</p>
          ) : null}
        </section>
      </div>
    </FormSheet>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-semibold text-[#7d8aa0]">{label}</span>
      {children}
      {error ? <p className="mt-1 text-[11px] text-[#c9564f]">{error}</p> : null}
    </label>
  );
}
