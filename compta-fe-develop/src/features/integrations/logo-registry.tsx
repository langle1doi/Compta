"use client";

import {
  SiQuickbooks,
  SiQuickbooksHex,
  SiRevolut,
  SiRevolutHex,
  SiSage,
  SiSageHex,
  SiStripe,
  SiStripeHex,
  SiXero,
  SiXeroHex,
} from "@icons-pack/react-simple-icons";
import {
  ArrowRightLeft,
  Braces,
  CreditCard,
  FileText,
  Landmark,
  Mail,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

type BrandIcon = ComponentType<SVGProps<SVGSVGElement> & { color?: string; size?: number | string }>;

type LogoEntry =
  | {
      kind: "brand";
      Icon: BrandIcon;
      color: string;
    }
  | {
      kind: "lucide";
      Icon: LucideIcon;
      color: string;
    };

/**
 * Explicit registry only — never import * from Simple Icons.
 * Missing Simple Icons brands fall back to Lucide (allowed for non-brand / unavailable marks).
 */
export const integrationLogoRegistry: Record<string, LogoEntry> = {
  stripe: { kind: "brand", Icon: SiStripe, color: SiStripeHex },
  sage: { kind: "brand", Icon: SiSage, color: SiSageHex },
  revolut: { kind: "brand", Icon: SiRevolut, color: SiRevolutHex },
  quickbooks: { kind: "brand", Icon: SiQuickbooks, color: SiQuickbooksHex },
  xero: { kind: "brand", Icon: SiXero, color: SiXeroHex },
  qonto: { kind: "lucide", Icon: Landmark, color: "#6C5CE7" },
  bridge: { kind: "lucide", Icon: Landmark, color: "#044ce2" },
  gocardless_bank: { kind: "lucide", Icon: Landmark, color: "#1C1B1F" },
  gocardless_payments: { kind: "lucide", Icon: CreditCard, color: "#1C1B1F" },
  email: { kind: "lucide", Icon: Mail, color: "#044ce2" },
  rest_api: { kind: "lucide", Icon: Braces, color: "#044ce2" },
  webhooks: { kind: "lucide", Icon: Webhook, color: "#238567" },
  meg_import: { kind: "lucide", Icon: ArrowRightLeft, color: "#7b61c8" },
  pdp: { kind: "lucide", Icon: FileText, color: "#516078" },
};

export function IntegrationLogo({
  logoKey,
  className,
  size = 28,
}: {
  logoKey: string;
  className?: string;
  size?: number;
}) {
  const entry = integrationLogoRegistry[logoKey] ?? {
    kind: "lucide" as const,
    Icon: Landmark,
    color: "#66758d",
  };

  return (
    <div className={cn("integration-logo", className)}>
      {entry.kind === "brand" ? (
        <entry.Icon aria-hidden="true" color={entry.color} size={size} />
      ) : (
        <entry.Icon
          aria-hidden="true"
          className="h-7 w-7"
          color={entry.color}
          strokeWidth={1.75}
        />
      )}
    </div>
  );
}
