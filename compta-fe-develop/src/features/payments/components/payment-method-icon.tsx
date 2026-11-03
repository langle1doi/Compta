import { ArrowDownToLine, Banknote, Building2, CreditCard, Landmark } from "lucide-react";

import { IconTile } from "@/components/dashboard/tone";
import type { InvoicePaymentMethod } from "@/features/invoices/model";

import { paymentMethodTone } from "../status";

const icons = {
  transfer: Landmark,
  card: CreditCard,
  direct_debit: ArrowDownToLine,
  cash: Banknote,
  check: Building2,
} as const;

export function PaymentMethodIcon({ method }: { method: InvoicePaymentMethod }) {
  return (
    <IconTile icon={icons[method]} size="xs" strokeWidth={2} tone={paymentMethodTone[method]} />
  );
}
