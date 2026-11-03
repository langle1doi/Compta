"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { LocaleSwitch } from "@/components/locale-switch";
import { ApiError, apiFetch } from "@/lib/api/client";

/** Only same-site paths: `next` comes from the URL, so it must not lead off-site. */
function safeNext(next: string | null, fallback: string) {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return fallback;
  }
  return next;
}

export function LoginForm({
  tenant,
  platform,
}: {
  /** Company being signed in to, from the address opened. */
  tenant: string | null;
  platform: boolean;
}) {
  const t = useTranslations("login");
  const locale = useLocale();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(platform ? "/platform/auth/login" : "/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
        withCompany: false,
        redirectOn401: false,
      });
      // Full navigation: nothing from a previous session survives in memory.
      window.location.assign(
        safeNext(
          params.get("next"),
          platform ? `/${locale}/platform` : `/${locale}`,
        ),
      );
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "";
      if (code === "TENANT_NOT_FOUND") setError(t("errors.tenantNotFound"));
      else if (code === "TENANT_SUSPENDED")
        setError(t("errors.tenantSuspended"));
      else if (code === "ACCOUNT_LOCKED") setError(t("errors.locked"));
      else if (code === "RATE_LIMITED") setError(t("errors.rateLimited"));
      else if (caught instanceof ApiError && caught.status === 401)
        setError(t("errors.credentials"));
      else if (caught instanceof ApiError && caught.status === 422)
        setError(t("errors.credentials"));
      else setError(t("errors.unavailable"));
      setSubmitting(false);
    }
  }

  return (
    <section className="dashboard-card dashboard-enter w-full min-w-0 p-5 sm:p-6">
      <h1 className="dashboard-card-title text-[18px]">{t("title")}</h1>
      <p className="mt-1 text-[13px] leading-5 text-[#66758d]">{t("body")}</p>
      {platform || tenant ? (
        <p
          className="mt-2 truncate text-[12px] font-semibold text-[#044ce2]"
          data-login-scope
        >
          {platform ? t("platform") : t("company", { tenant: tenant ?? "" })}
        </p>
      ) : null}

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <label className="block" htmlFor="login-email">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
            {t("email")}
          </span>
          <input
            autoComplete="username"
            autoFocus
            className="h-11 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30"
            id="login-email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="block" htmlFor="login-password">
          <span className="mb-1.5 block text-[11px] font-medium text-[#5f6f88]">
            {t("password")}
          </span>
          <input
            autoComplete="current-password"
            className="h-11 w-full rounded-[10px] border border-[#dfe6f1] bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/30"
            id="login-password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? (
          <p className="text-[12px] font-medium text-[#c9564f]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="action-motion soft-primary min-h-11 w-full rounded-[10px] px-3 text-sm font-semibold text-white disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? t("submitting") : t("submit")}
        </button>
      </form>

      <div className="mt-5 border-t border-[#edf2f8] pt-4">
        <LocaleSwitch />
      </div>
    </section>
  );
}
