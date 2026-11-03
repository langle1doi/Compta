"use client";

import { useTranslations } from "next-intl";

export function IntegrationApiKeysPanel() {
  const t = useTranslations("integrations.developer");

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-5 text-[#516078]">{t("apiIntro")}</p>
      <div className="rounded-[14px] border border-[#e4ecf6] bg-[#f8fbff] p-3.5">
        <p className="text-[12px] text-[#7d8aa0]">{t("apiKeyMasked")}</p>
        <p className="mt-0.5 font-mono text-[13px] font-medium tracking-wide text-[#24334c]">
          ••••••••••7F2A
        </p>
        <p className="mt-2 rounded-[10px] bg-[#f3f6fb] px-2.5 py-1.5 text-[11px] leading-4 text-[#66758d]">
          {t("apiKeyNote")}
        </p>
      </div>
      <a
        className="inline-flex text-[12px] font-semibold text-[#145be7] hover:underline"
        href="#"
        onClick={(event) => event.preventDefault()}
      >
        {t("docsLink")}
      </a>
    </div>
  );
}

export function IntegrationWebhooksPanel() {
  const t = useTranslations("integrations.developer");

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-5 text-[#516078]">{t("webhookIntro")}</p>
      <div className="space-y-3 rounded-[14px] border border-[#e4ecf6] bg-[#f8fbff] p-3.5">
        <div>
          <p className="text-[12px] text-[#7d8aa0]">{t("endpoint")}</p>
          <p className="mt-0.5 break-all font-mono text-[12px] font-medium text-[#24334c]">
            https://hooks.example.com/compte/events
          </p>
        </div>
        <div>
          <p className="text-[12px] text-[#7d8aa0]">{t("events")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] text-[#405069]">
            <li>invoice.validated</li>
            <li>payment.recorded</li>
            <li>customer.updated</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function IntegrationMegPanel() {
  const t = useTranslations("integrations.developer");

  return (
    <div className="rounded-[14px] border border-dashed border-[#dce6f3] px-4 py-8 text-center">
      <p className="text-sm font-semibold text-[#24334c]">{t("megEmptyTitle")}</p>
      <p className="mt-1 text-[12px] text-[#7d8aa0]">{t("megEmptyBody")}</p>
    </div>
  );
}
