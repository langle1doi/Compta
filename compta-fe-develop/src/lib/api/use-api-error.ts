"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { ApiError } from "./client";

/** Turns a backend error into a localized message, from its stable `code`. */
export function useApiErrorMessage() {
  const t = useTranslations("apiErrors");

  const message = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) {
        if (t.has(`codes.${error.code}`)) return t(`codes.${error.code}`);
        if (error.status === 0 || error.status >= 500) return t("unavailable");
      }
      return t("generic");
    },
    [t],
  );

  const fieldMessage = useCallback(
    (field: { code: string; message: string }) =>
      t.has(`fields.${field.code}`) ? t(`fields.${field.code}`) : field.message,
    [t],
  );

  return { message, fieldMessage };
}
