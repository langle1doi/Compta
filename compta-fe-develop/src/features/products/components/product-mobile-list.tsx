"use client";

import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/dashboard/tone";
import { formatMoneyFromCents } from "@/lib/money";

import type { ProductRecord, ProductUsageLink } from "../model";
import { usageCount } from "../query";

export function ProductMobileList({
  products,
  usage,
  onOpen,
}: {
  products: ProductRecord[];
  usage: ProductUsageLink[];
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("products");

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 lg:hidden">
      {products.map((product) => {
        const uses = usageCount(usage, product.id);
        return (
          <li key={product.id}>
            <button
              className="dashboard-card flex w-full min-w-0 flex-col gap-1 px-3 py-3 text-left"
              type="button"
              onClick={() => onOpen(product.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="dashboard-list__primary dashboard-list__link tabular-nums">
                  {product.code}
                </span>
                <StatusBadge
                  size="xs"
                  tone={product.status === "active" ? "green" : "slate"}
                >
                  {t(`status.${product.status}`)}
                </StatusBadge>
              </div>
              <p className="dashboard-list__primary truncate">{product.name}</p>
              <p className="dashboard-list__secondary truncate">
                {product.description || t(`categories.${product.categoryId}`)}
              </p>
              <strong className="dashboard-list__amount mt-0.5 block">
                {formatMoneyFromCents(product.unitPriceCents)}
                <span className="ml-1 text-[11px] font-medium text-[#7d8aa0]">
                  / {t(`units.${product.unit}`)}
                </span>
              </strong>
              <p className="dashboard-list__secondary">
                {t(`type.${product.type}`)}
                <span className="mx-1.5 text-[#c5ceda]">·</span>
                {t(`categories.${product.categoryId}`)}
                <span className="mx-1.5 text-[#c5ceda]">·</span>
                {t("vatShort", { rate: product.vatRate })}
              </p>
              <p className="dashboard-list__secondary">
                {t("usedDocuments", { count: uses })}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
