"use client";

import { useTranslations } from "next-intl";

import { FormSheet } from "@/components/forms/form-sheet";

import { IntegrationLogo } from "../../logo-registry";
import type { IntegrationDefinition } from "../../model";

export function ConnectIntegrationSheet({
  open,
  definition,
  companyName,
  onClose,
  onContinue,
}: {
  open: boolean;
  definition: IntegrationDefinition | null;
  companyName: string;
  onClose: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations("integrations");

  if (!definition) return null;

  const isOauth = definition.authType === "oauth";
  const isApi = definition.authType === "api_key";

  return (
    <FormSheet
      description={t("connect.description")}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
            type="button"
            onClick={onClose}
          >
            {t("connect.cancel")}
          </button>
          <button
            className="action-motion soft-primary min-h-10 rounded-[10px] px-3 text-sm font-semibold text-white"
            type="button"
            onClick={onContinue}
          >
            {isOauth ? t("connect.continueProvider") : t("connect.confirm")}
          </button>
        </div>
      }
      open={open}
      title={t("connect.title", { name: t(definition.nameKey) })}
      widthClassName="sm:max-w-[460px]"
      onClose={onClose}
    >
      <div className="space-y-4 p-1">
        <div className="flex items-center gap-3 rounded-[14px] border border-[#e4ecf6] bg-[#f8fbff] p-3.5">
          <IntegrationLogo logoKey={definition.logoKey} />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#173156]">
              {t(definition.nameKey)}
            </p>
            <p className="text-[12px] text-[#7d8aa0]">
              {t(`categories.${definition.category}`)}
            </p>
          </div>
        </div>

        <dl className="space-y-3 text-[13px]">
          <div>
            <dt className="text-[#7d8aa0]">{t("connect.scope")}</dt>
            <dd className="mt-0.5 font-medium text-[#24334c]">
              {definition.scope === "tenant"
                ? t("scope.tenant")
                : companyName}
            </dd>
          </div>
          <div>
            <dt className="text-[#7d8aa0]">{t("connect.auth")}</dt>
            <dd className="mt-0.5 font-medium text-[#24334c]">
              {isOauth
                ? t("auth.oauth")
                : isApi
                  ? t("auth.apiKey")
                  : definition.authType === "credentials"
                    ? t("auth.smtp")
                    : t("auth.internal")}
            </dd>
          </div>
        </dl>

        <div>
          <p className="text-[12px] font-semibold text-[#7d8aa0]">
            {t("connect.permissions")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-[#405069]">
            {definition.capabilities.map((capability) => (
              <li key={capability}>{t(`capabilities.${capability}`)}</li>
            ))}
          </ul>
        </div>

        {isOauth ? (
          <p className="rounded-[12px] bg-[#f3f6fb] px-3 py-2 text-[12px] leading-5 text-[#66758d]">
            {t("connect.oauthNote")}
          </p>
        ) : null}
      </div>
    </FormSheet>
  );
}
