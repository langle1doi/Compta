"use client";

import { useTranslations } from "next-intl";

import { ConfirmDialog } from "@/components/compte/confirm-dialog";

export function DisconnectIntegrationDialog({
  open,
  providerName,
  scopeLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  providerName: string;
  scopeLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("integrations");

  return (
    <ConfirmDialog
      body={t("disconnect.body", { scope: scopeLabel })}
      cancelLabel={t("disconnect.cancel")}
      confirmLabel={t("disconnect.confirm")}
      danger
      open={open}
      title={t("disconnect.title", { name: providerName })}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
