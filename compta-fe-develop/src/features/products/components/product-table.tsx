"use client";

import { useTranslations } from "next-intl";

import { DashboardScroll } from "@/components/dashboard/dashboard-scroll";
import { StatusBadge } from "@/components/dashboard/tone";
import { formatMoneyFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { ProductRecord, ProductUsageLink } from "../model";
import { usageCount } from "../query";

const cell = "min-w-0 overflow-hidden";

export function ProductTable({
  products,
  usage,
  selectedId,
  onOpen,
}: {
  products: ProductRecord[];
  usage: ProductUsageLink[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("products");

  return (
    <DashboardScroll scrollClassName="overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-left xl:min-w-0">
        <colgroup>
          <col style={{ width: 128 }} />
          <col />
          <col style={{ width: 100 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 72 }} />
          <col style={{ width: 100 }} />
        </colgroup>
        <thead className="dashboard-list__head">
          <tr>
            <th className={cell}>{t("columns.sku")}</th>
            <th className={cell}>{t("columns.product")}</th>
            <th className={cell}>{t("columns.type")}</th>
            <th className={cell}>{t("columns.category")}</th>
            <th className={cell}>{t("columns.unit")}</th>
            <th className={`${cell} text-right`}>{t("columns.unitPrice")}</th>
            <th className={cell}>{t("columns.vat")}</th>
            <th className={cell}>{t("columns.status")}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const active = selectedId === product.id;
            const uses = usageCount(usage, product.id);
            return (
              <tr
                className={cn(
                  "dashboard-list__row cursor-pointer",
                  active && "bg-[#eef4ff]",
                )}
                key={product.id}
                onClick={() => onOpen(product.id)}
              >
                <td className={cn(cell, "relative")}>
                  {active ? (
                    <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[#044ce2]" />
                  ) : null}
                  <span
                    className="dashboard-list__primary dashboard-list__link block max-w-full truncate text-left tabular-nums"
                    title={product.code}
                  >
                    {product.code}
                  </span>
                </td>
                <td className={cell}>
                  <span
                    className="dashboard-list__primary block max-w-full truncate text-left"
                    title={product.name}
                  >
                    {product.name}
                  </span>
                  <span
                    className="dashboard-list__secondary"
                    title={product.description || t("usedDocuments", { count: uses })}
                  >
                    {product.description || t("usedDocuments", { count: uses })}
                  </span>
                </td>
                <td className={cell}>
                  <StatusBadge size="xs" tone={product.type === "service" ? "blue" : "slate"}>
                    {t(`type.${product.type}`)}
                  </StatusBadge>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__secondary truncate">
                    {t(`categories.${product.categoryId}`)}
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__secondary">{t(`units.${product.unit}`)}</span>
                </td>
                <td className={`${cell} text-right`}>
                  <span className="dashboard-list__amount block truncate">
                    {formatMoneyFromCents(product.unitPriceCents)}
                  </span>
                </td>
                <td className={cell}>
                  <span className="dashboard-list__secondary tabular-nums">
                    {product.vatRate}%
                  </span>
                </td>
                <td className={cell}>
                  <StatusBadge
                    className="dashboard-list__badge max-w-full"
                    size="xs"
                    tone={product.status === "active" ? "green" : "slate"}
                  >
                    {t(`status.${product.status}`)}
                  </StatusBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DashboardScroll>
  );
}
