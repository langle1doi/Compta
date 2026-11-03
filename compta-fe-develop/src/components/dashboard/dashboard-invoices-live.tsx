"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { InvoicesListSheet } from "@/components/dashboard/invoices-list-sheet";
import { InvoicesToFollow } from "@/components/dashboard/invoices-to-follow";
import { CardHeader } from "@/components/dashboard/overview/dashboard-card";
import { can } from "@/features/settings/can";
import { usePermissions } from "@/features/settings/session-provider";
import type { Invoice } from "@/mocks/dashboard/types";

export function DashboardInvoicesLive({ invoices }: { invoices: Invoice[] }) {
  const t = useTranslations();
  const [listOpen, setListOpen] = useState(false);
  const activePermissions = usePermissions();

  if (!can(activePermissions, "invoice.read")) return null;

  return (
    <>
      <CardHeader
        action={t("invoices.open")}
        actionAriaLabel={t("invoices.listFull.openAria")}
        title={t("invoices.title")}
        titleId="invoices-title"
        onActionClick={() => setListOpen(true)}
      />
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <InvoicesToFollow invoices={invoices} />
      </div>
      <InvoicesListSheet
        invoices={invoices}
        open={listOpen}
        onClose={() => setListOpen(false)}
      />
    </>
  );
}
