"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiErrorState } from "@/components/compte/api-error-state";
import { ConfirmDialog } from "@/components/compte/confirm-dialog";
import { SoftToast } from "@/components/compte/soft-toast";
import { useCan } from "@/features/settings/can";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";

import {
  detectDuplicatesIn,
  useCustomerDetail,
  useCustomerOwners,
  useCustomers,
} from "../services/customers-service";
import type { CustomerRecord } from "../types";
import { CustomerDetailsPanel } from "./customer-details-panel";
import { DuplicateCustomerDialog } from "./duplicate-customer-dialog";

export function CustomerDetailView({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const router = useRouter();
  const check = useCan();
  const { customers } = useCustomers();
  const detail = useCustomerDetail(customerId);
  const displayCustomer = detail.data ?? null;
  const owners = useCustomerOwners(displayCustomer ? [...customers, displayCustomer] : customers);
  const [notice, setNotice] = useState("");
  const [pendingResume, setPendingResume] = useState<(() => void) | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<CustomerRecord[]>([]);
  const [detailGuard, setDetailGuard] = useState({ editing: false, dirty: false });
  const [discardCloseOpen, setDiscardCloseOpen] = useState(false);

  const owner = owners.find((item) => item.id === displayCustomer?.ownerId);
  const missing = detail.error instanceof ApiError && detail.error.status === 404;

  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
      <div className="dashboard-page flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2">
          <Link
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#044ce2] hover:underline"
            href="/customers"
            onClick={(event) => {
              if (detailGuard.editing && detailGuard.dirty) {
                event.preventDefault();
                setDiscardCloseOpen(true);
              }
            }}
          >
            ← {t("title")}
          </Link>
        </div>

        {displayCustomer ? (
          <section className="dashboard-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <CustomerDetailsPanel
              key={displayCustomer.id}
              canUpdate={check("customer.update")}
              customer={displayCustomer}
              embedded
              owner={owner}
              owners={owners}
              onDuplicateFound={(draft, resume) => {
                const found = detectDuplicatesIn(
                  customers,
                  {
                    displayName: draft.displayName,
                    email: draft.email,
                    siret: draft.siret,
                    vatNumber: draft.vatNumber,
                  },
                  displayCustomer.id,
                );
                if (found.length) {
                  setPendingResume(() => resume);
                  setDuplicateCandidates(found);
                  return;
                }
                resume();
              }}
              onEditingChange={setDetailGuard}
              onDeleted={() => router.push("/customers")}
              onSaved={() => {
                setNotice(t("updated"));
                setDetailGuard({ editing: false, dirty: false });
              }}
            />
          </section>
        ) : detail.isLoading ? null : detail.error && !missing ? (
          <section className="dashboard-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ApiErrorState error={detail.error} />
          </section>
        ) : (
          <section className="dashboard-card px-3.5 py-3">
            <p className="dashboard-card-title">{t("details.notFound")}</p>
            <p className="mt-1.5 text-xs leading-5 text-[#516078]">{t("details.emptyBody")}</p>
          </section>
        )}
      </div>

      <DuplicateCustomerDialog
        candidates={duplicateCandidates}
        open={duplicateCandidates.length > 0}
        onClose={() => {
          setDuplicateCandidates([]);
          setPendingResume(null);
        }}
        onContinue={() => {
          pendingResume?.();
          setDuplicateCandidates([]);
          setPendingResume(null);
        }}
        onReview={(id) => {
          setDuplicateCandidates([]);
          setPendingResume(null);
          if (id !== customerId) router.push(`/customers/${id}`);
        }}
      />

      <ConfirmDialog
        body={t("details.discardConfirm")}
        cancelLabel={t("details.keepEditing")}
        confirmLabel={t("details.discardAction")}
        danger
        open={discardCloseOpen}
        title={t("details.discardTitle")}
        onCancel={() => setDiscardCloseOpen(false)}
        onConfirm={() => {
          setDiscardCloseOpen(false);
          router.push("/customers");
        }}
      />

      {notice ? (
        <SoftToast message={notice} tone="success" onDismiss={() => setNotice("")} />
      ) : null}
    </main>
  );
}
