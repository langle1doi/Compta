"use client";

import { AlertCircle, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { ApiError } from "@/lib/api/client";
import { useApiErrorMessage } from "@/lib/api/use-api-error";

/** Empty-state shaped message for a list that failed to load. */
export function ApiErrorState({ error }: { error: unknown }) {
  const { message } = useApiErrorMessage();
  const t = useTranslations("access");

  if (error instanceof ApiError && error.status === 403) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center"
        role="alert"
      >
        <ShieldAlert aria-hidden="true" className="h-8 w-8 text-[#b7c3d6]" />
        <p className="text-sm font-semibold text-[#24334c]">{t("forbidden.title")}</p>
        <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">{t("forbidden.body")}</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center"
      role="alert"
    >
      <AlertCircle aria-hidden="true" className="h-8 w-8 text-[#b7c3d6]" />
      <p className="max-w-[42ch] text-sm font-semibold text-[#24334c]">
        {message(error)}
      </p>
    </div>
  );
}
