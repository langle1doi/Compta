"use client";

import { FileText, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { SoftSelect } from "@/components/compte/soft-select";
import { FormSheet } from "@/components/forms/form-sheet";
import { useCurrentCompany } from "@/features/settings/company-store";
import { cn } from "@/lib/utils";

import type {
  DocumentUseCase,
  EmailUseCase,
  TemplateLanguage,
  TemplateType,
  TemplateUseCase,
} from "../model";
import { createTemplate } from "../store";
import { isDocumentUseCase } from "../utils";

type Step = "type" | "useCase" | "info";

const documentUseCases: DocumentUseCase[] = ["quote", "invoice", "credit_note"];
const emailUseCases: EmailUseCase[] = [
  "payment_reminder",
  "quote_follow_up",
  "quote_email",
  "invoice_email",
];

export function NewTemplateSheet({
  open,
  canCreateDocument,
  canCreateEmail,
  onClose,
  onCreated,
}: {
  canCreateDocument: boolean;
  canCreateEmail: boolean;
  open: boolean;
  onClose: () => void;
  onCreated: (created: { id: string; type: TemplateType }) => void;
}) {
  const t = useTranslations("templates.wizard");
  const { company } = useCurrentCompany();
  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<TemplateType | null>(null);
  const [useCase, setUseCase] = useState<TemplateUseCase | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<TemplateLanguage>("fr");
  const [setDefault, setSetDefault] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setStep("type");
    setType(null);
    setUseCase(null);
    setName("");
    setLanguage("fr");
    setSetDefault(false);
    setError("");
  }

  function close() {
    reset();
    onClose();
  }

  const useCaseOptions = useMemo(() => {
    const list = type === "email" ? emailUseCases : documentUseCases;
    return list.map((value) => ({
      value,
      label: t(`useCases.${value}`),
    }));
  }, [t, type]);

  function selectType(next: TemplateType) {
    setType(next);
    setUseCase(null);
    setError("");
  }

  function goUseCase() {
    if (!type) {
      setError(t("errors.type"));
      return;
    }
    setError("");
    setStep("useCase");
  }

  function goInfo() {
    if (!useCase) {
      setError(t("errors.useCase"));
      return;
    }
    if (!name.trim()) {
      setName(t(`useCases.${useCase}`));
    }
    setError("");
    setStep("info");
  }

  function create() {
    if (!type || !useCase || !name.trim()) {
      setError(t("errors.name"));
      return;
    }
    if (type === "document" && !isDocumentUseCase(useCase)) {
      setError(t("errors.useCase"));
      return;
    }
    if (type === "email" && isDocumentUseCase(useCase)) {
      setError(t("errors.useCase"));
      return;
    }
    const created = createTemplate({
      name: name.trim(),
      type,
      useCase,
      companyId: company.id,
      companyName: company.name,
      language,
      setDefault,
    });
    reset();
    onCreated({ id: created.id, type: created.type });
  }

  return (
    <FormSheet
      description={t(`steps.${step}Hint`)}
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <button
            className="action-motion soft-button h-9 rounded-[9px] px-3 text-xs font-semibold text-[#405069]"
            type="button"
            onClick={() => {
              if (step === "type") close();
              else if (step === "useCase") setStep("type");
              else setStep("useCase");
            }}
          >
            {step === "type" ? t("cancel") : t("back")}
          </button>
          <button
            className="action-motion soft-primary h-9 rounded-[9px] px-3 text-xs font-semibold text-white"
            type="button"
            onClick={() => {
              if (step === "type") goUseCase();
              else if (step === "useCase") goInfo();
              else create();
            }}
          >
            {step === "info" ? t("create") : t("continue")}
          </button>
        </div>
      }
      open={open}
      title={t("title")}
      widthClassName="sm:max-w-[520px]"
      onClose={close}
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {step === "type" ? (
          <div
            className={cn(
              "grid grid-cols-1 gap-2",
              canCreateDocument && canCreateEmail && "sm:grid-cols-2",
            )}
          >
            {(
              [
                ["document", FileText],
                ["email", Mail],
              ] as const
            )
              .filter(([value]) =>
                value === "document" ? canCreateDocument : canCreateEmail,
              )
              .map(([value, Icon]) => {
                const active = type === value;
                return (
                  <button
                    className={cn(
                      "flex min-w-0 flex-col items-start gap-2 rounded-[12px] border p-4 text-left transition-colors",
                      active
                        ? "border-[#2458d6] bg-[#f4f8ff]"
                        : "border-[#e1e7f1] hover:border-[#c9d6ea]",
                    )}
                    key={value}
                    type="button"
                    onClick={() => selectType(value)}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "h-5 w-5",
                        active ? "text-[#2458d6]" : "text-[#7d8aa0]",
                      )}
                    />
                    <span className="text-[13px] font-semibold text-[#24334c]">
                      {t(`types.${value}`)}
                    </span>
                    <span className="text-[11px] leading-4 text-[#7d8aa0]">
                      {t(`types.${value}Hint`)}
                    </span>
                  </button>
                );
              })}
          </div>
        ) : null}

        {step === "useCase" ? (
          <div className="grid grid-cols-1 gap-2">
            {useCaseOptions.map((option) => {
              const active = useCase === option.value;
              return (
                <button
                  className={cn(
                    "rounded-[10px] border px-3 py-2.5 text-left text-[13px] font-semibold transition-colors",
                    active
                      ? "border-[#2458d6] bg-[#f4f8ff] text-[#2458d6]"
                      : "border-[#e1e7f1] text-[#24334c] hover:border-[#c9d6ea]",
                  )}
                  key={option.value}
                  type="button"
                  onClick={() => setUseCase(option.value as TemplateUseCase)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {step === "info" ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-[#66758d]">
                {t("fields.name")} *
              </span>
              <input
                className="soft-input h-9 rounded-[9px] px-3 text-xs"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-[#66758d]">
                {t("fields.company")}
              </span>
              <input
                className="soft-input h-9 rounded-[9px] px-3 text-xs"
                disabled
                value={company.name}
              />
            </label>
            <SoftSelect
              label={t("fields.language")}
              options={[
                { value: "fr", label: "FR" },
                { value: "en", label: "EN" },
                { value: "vi", label: "VI" },
              ]}
              value={language}
              onChange={(value) => setLanguage(value as TemplateLanguage)}
            />
            <label className="flex items-center gap-2 text-[12px] text-[#405069]">
              <input
                checked={setDefault}
                className="rounded border-[#c9d6ea]"
                type="checkbox"
                onChange={(event) => setSetDefault(event.target.checked)}
              />
              {t("fields.setDefault")}
            </label>
          </div>
        ) : null}

        {error ? (
          <p className="text-[12px] font-medium text-[#c9564f]">{error}</p>
        ) : null}
      </div>
    </FormSheet>
  );
}
