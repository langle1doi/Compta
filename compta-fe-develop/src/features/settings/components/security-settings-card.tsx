"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { StatusBadge } from "@/components/dashboard/tone";
import { FormSheet } from "@/components/forms/form-sheet";

import type { SecuritySettingsConfig } from "../types";

export function SecuritySettingsCard({ initial }: { initial: SecuritySettingsConfig }) {
  const t = useTranslations("usersPermissions");
  const [totp, setTotp] = useState(initial.totpEnabled);
  const [email2fa, setEmail2fa] = useState(initial.email2faEnabled);
  const [lockout, setLockout] = useState(String(initial.failedLoginLockout));
  const [language, setLanguage] = useState(initial.preferredLanguage);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  return (
    <section
      aria-labelledby="security-settings-title"
      className="dashboard-card dashboard-enter flex min-w-0 flex-col p-3.5"
    >
      <h3 className="dashboard-card-title" id="security-settings-title">
        {t("security.title")}
      </h3>
      <p className="mt-1 text-[12px] leading-5 text-[#7a899e]">{t("security.subtitle")}</p>

      <ul className="mt-3 space-y-2">
        <SecurityToggle
          checked={totp}
          label={t("security.totp")}
          onToggle={() => setTotp((value) => !value)}
        />
        <SecurityToggle
          checked={email2fa}
          label={t("security.email2fa")}
          onToggle={() => setEmail2fa((value) => !value)}
        />

        <li className="rounded-[12px] border border-[#e8eef6] px-3 py-2.5">
          <p className="text-[12px] font-semibold text-[#1b2d47]">{t("security.sso")}</p>
          <div className="mt-2 space-y-1.5">
            <SsoRow
              label={t("security.google")}
              status={initial.googleSso}
              statusLabel={t(`security.status.${initial.googleSso}`)}
            />
            <SsoRow
              label={t("security.microsoft")}
              status={initial.microsoftSso}
              statusLabel={t(`security.status.${initial.microsoftSso}`)}
            />
          </div>
        </li>

        <li className="rounded-[12px] border border-[#e8eef6] px-3 py-2.5">
          <p className="text-[12px] font-semibold text-[#1b2d47]">{t("security.lockout")}</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              aria-label={t("security.lockout")}
              className="h-10 w-16 rounded-[10px] border border-[#dfe6f1] px-2 text-center text-sm font-semibold text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/35"
              inputMode="numeric"
              value={lockout}
              onChange={(event) => setLockout(event.target.value)}
            />
            <span className="text-[12px] text-[#66758d]">{t("security.attempts")}</span>
          </div>
        </li>

        <li className="rounded-[12px] border border-[#e8eef6] px-3 py-2.5">
          <p className="text-[12px] font-semibold text-[#1b2d47]">{t("security.language")}</p>
          <div className="mt-2 grid gap-1.5" role="radiogroup" aria-label={t("security.language")}>
            {(
              [
                ["fr", t("security.lang.fr")],
                ["en", t("security.lang.en")],
                ["vi", t("security.lang.vi")],
              ] as const
            ).map(([code, label]) => (
              <button
                aria-checked={language === code}
                className={`flex min-h-10 items-center rounded-[10px] border px-3 text-left text-sm ${
                  language === code
                    ? "border-[#b9d0fb] bg-[#f2f6ff] font-semibold text-[#044ce2]"
                    : "border-[#e8eef6] text-[#405069] hover:border-[#b9d0fb]"
                }`}
                key={code}
                role="radio"
                type="button"
                onClick={() => setLanguage(code)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#7a899e]">{t("security.languageHint")}</p>
        </li>
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="action-motion soft-button inline-flex min-h-10 items-center rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
          type="button"
        >
          {t("security.resetPassword")}
        </button>
        <button
          className="action-motion soft-button inline-flex min-h-10 items-center rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
          type="button"
          onClick={() => setSessionsOpen(true)}
        >
          {t("security.manageSessions")}
        </button>
      </div>

      <FormSheet
        closeLabel={t("dialogs.close")}
        open={sessionsOpen}
        title={t("security.sessionsTitle")}
        widthClassName="sm:max-w-[420px]"
        onClose={() => setSessionsOpen(false)}
        footer={
          <div className="flex justify-end">
            <button
              className="soft-button min-h-10 rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
              type="button"
              onClick={() => setSessionsOpen(false)}
            >
              {t("dialogs.close")}
            </button>
          </div>
        }
      >
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between gap-3 rounded-[12px] border border-[#e8eef6] px-3 py-2.5">
            <span>
              <span className="block font-semibold text-[#1b2d47]">
                {t("security.currentDevice")}
              </span>
              <span className="text-[12px] text-[#7a899e]">{t("security.now")}</span>
            </span>
            <StatusBadge size="xs" tone="green">
              {t("security.active")}
            </StatusBadge>
          </li>
          <li className="flex items-center justify-between gap-3 rounded-[12px] border border-[#e8eef6] px-3 py-2.5">
            <span>
              <span className="block font-semibold text-[#1b2d47]">
                {t("security.otherSession")}
              </span>
              <span className="text-[12px] text-[#7a899e]">Paris · 2 d ago</span>
            </span>
            <button className="text-sm font-semibold text-[#c9564f]" type="button">
              {t("security.revoke")}
            </button>
          </li>
        </ul>
      </FormSheet>
    </section>
  );
}

function SecurityToggle({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        aria-checked={checked}
        className="series-switch flex w-full items-center justify-between gap-3 rounded-[12px] border border-[#e8eef6] px-3 py-2.5 text-left"
        role="switch"
        type="button"
        onClick={onToggle}
      >
        <span className="text-[12px] font-semibold text-[#1b2d47]">{label}</span>
        <span className="series-switch__track shrink-0">
          <span className="series-switch__knob" />
        </span>
      </button>
    </li>
  );
}

function SsoRow({
  label,
  status,
  statusLabel,
}: {
  label: string;
  status: "connected" | "not_configured";
  statusLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-[12px] text-[#405069]">{label}</span>
      <StatusBadge size="xs" tone={status === "connected" ? "green" : "slate"}>
        {statusLabel}
      </StatusBadge>
    </div>
  );
}
