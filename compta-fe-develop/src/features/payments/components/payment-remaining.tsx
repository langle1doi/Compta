"use client";

import { useTranslations } from "next-intl";

import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { PaymentListStatus } from "../model";

export function PaymentRemaining({
  remainingCents,
  status,
  align = "left",
}: {
  remainingCents: number;
  status: PaymentListStatus;
  align?: "left" | "right";
}) {
  const t = useTranslations("payments.remaining");
  const amount = formatMoneyFromCents(status === "paid" ? 0 : remainingCents);

  return (
    <span className={cn("block min-w-0 overflow-hidden", align === "right" && "text-right")}>
      <span className="dashboard-list__amount block truncate" title={amount}>
        {amount}
      </span>
      <span className="dashboard-list__secondary block truncate">{t(status)}</span>
    </span>
  );
}
