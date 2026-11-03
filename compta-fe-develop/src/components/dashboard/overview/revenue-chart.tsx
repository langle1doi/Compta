"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { formatDecimal, formatEuro } from "@/lib/money";
import {
  currentMonthIndex,
  fiscalYear,
  monthlyCollected,
  monthlyRevenue,
  monthlyTarget,
  previousYears,
} from "@/mocks/dashboard";

import { CardHeader, DemoTag } from "./dashboard-card";
import { useDashboardPeriod, type DashboardPeriod } from "./period-context";
import { useRevealOnce } from "./use-reveal-once";

type Series = "revenue" | "collected" | "target";

type Column = {
  label: string;
  value: number | null;
  target: number;
  current: boolean;
};

const seriesOptions: Series[] = ["revenue", "collected", "target"];
const periods: DashboardPeriod[] = ["month", "quarter", "year"];

const sumOrNull = (values: Array<number | null>) =>
  values.every((value) => value === null)
    ? null
    : values.reduce<number>((total, value) => total + (value ?? 0), 0);

const yearSum = (values: Array<number | null>) => sumOrNull(values) ?? 0;

function niceCeil(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * magnitude >= value) ?? 10;
  return step * magnitude;
}

function formatTick(value: number) {
  if (value === 0) return "0";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : formatDecimal(millions, 1)} M€`;
  }
  return `${Math.round(value / 1_000)} k€`;
}

function buildColumns(
  period: DashboardPeriod,
  series: Series,
  labels: { months: string[]; quarters: string[] },
): Column[] {
  const monthly = { revenue: monthlyRevenue, collected: monthlyCollected, target: monthlyTarget };
  const values = monthly[series];

  if (period === "month") {
    return labels.months.map((label, index) => ({
      label,
      value: values[index] ?? null,
      target: monthlyTarget[index],
      current: index === currentMonthIndex,
    }));
  }

  if (period === "quarter") {
    const currentQuarter = Math.floor(currentMonthIndex / 3);
    return labels.quarters.map((label, quarter) => {
      const months = [0, 1, 2].map((offset) => quarter * 3 + offset);
      return {
        label,
        value: sumOrNull(months.map((month) => values[month] ?? null)),
        target: yearSum(months.map((month) => monthlyTarget[month])),
        current: quarter === currentQuarter,
      };
    });
  }

  return [
    ...previousYears.map((entry) => ({
      label: String(entry.year),
      value: entry[series],
      target: entry.target,
      current: false,
    })),
    {
      label: String(fiscalYear),
      value: yearSum(values),
      target: yearSum(monthlyTarget),
      current: true,
    },
  ];
}

export function RevenueChart({ style }: { style?: CSSProperties }) {
  const t = useTranslations("overview");
  const { period, setPeriod } = useDashboardPeriod();
  const [series, setSeries] = useState<Series>("revenue");
  const [plotRef, revealed] = useRevealOnce<HTMLDivElement>();

  const columns = buildColumns(period, series, {
    months: t("revenue.months").split(","),
    quarters: t("revenue.quarters").split(","),
  });
  const showTargetMarks = series !== "target";
  const peak = Math.max(
    ...columns.map((column) => Math.max(column.value ?? 0, showTargetMarks ? column.target : 0)),
  );
  const step = niceCeil(peak / 3);
  const top = step * 3;
  const ticks = [3, 2, 1, 0].map((multiple) => multiple * step);

  const total = columns.reduce((sum, column) => sum + (column.value ?? 0), 0);
  const seriesLabel = t(`revenue.series.${series}`);
  const totalLabel =
    period === "year"
      ? t("revenue.totalYear")
      : series === "target"
        ? `${seriesLabel} ${fiscalYear}`
        : t("revenue.totalMonth", { year: fiscalYear });
  const lastIndex = columns.length - 1;

  return (
    <section
      aria-labelledby="revenue-chart-title"
      className="dashboard-card dashboard-enter dashboard-anchor flex min-h-[220px] flex-col px-4 py-3 lg:h-full lg:min-h-0"
      id="dashboard-revenue"
      style={style}
    >
      <CardHeader
        meta={
          <>
            <DemoTag hint={t("demoHint")} label={t("demo")} />
            <span className="ml-1 flex min-w-0 items-baseline gap-1.5">
              <strong className="text-[15px] leading-none font-bold tracking-[-0.02em] text-[#102342] tabular-nums">
                {formatEuro(total)}
              </strong>
              <span className="truncate text-[10px] text-[#7a899e]">{totalLabel}</span>
            </span>
          </>
        }
        title={t("revenue.title")}
        titleId="revenue-chart-title"
      >
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <div aria-label={t("period.label")} className="segmented" role="group">
            {periods.map((option) => (
              <button
                aria-pressed={period === option}
                className="segmented-option"
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
              >
                {t(`period.${option}`)}
              </button>
            ))}
          </div>
          <div aria-label={t("revenue.seriesLabel")} className="segmented" role="group">
            {seriesOptions.map((option) => (
              <button
                aria-pressed={series === option}
                className="segmented-option"
                key={option}
                type="button"
                onClick={() => setSeries(option)}
              >
                {t(`revenue.series.${option}`)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <div className="mt-2 flex min-h-[130px] flex-1 gap-2" aria-hidden="true">
        <div className="flex w-9 shrink-0 flex-col text-right text-[9px] text-[#8a98ab] tabular-nums">
          <div className="relative flex-1">
            {ticks.map((tick) => (
              <span
                className="absolute right-0 translate-y-1/2 leading-none"
                key={tick}
                style={{ bottom: `${(tick / top) * 100}%` }}
              >
                {formatTick(tick)}
              </span>
            ))}
          </div>
          <div className="h-4 shrink-0" />
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            className="chart-plot relative flex min-h-0 flex-1 items-end gap-1 sm:gap-2"
            data-revealed={revealed}
            ref={plotRef}
          >
            {ticks.map((tick) => (
              <span
                className="pointer-events-none absolute inset-x-0 h-px bg-[#e3e9f1]"
                key={tick}
                style={{ bottom: `${(tick / top) * 100}%` }}
              />
            ))}

            {columns.map((column, index) => {
              const height = column.value === null ? 0 : (column.value / top) * 100;
              const delay = index * 20 + (column.current ? 60 : 0);
              const barStyle = {
                height: column.value === null ? "4px" : `${Math.max(height, 1.5)}%`,
                "--bar-delay": `${delay}ms`,
              } as CSSProperties;

              return (
                <div
                  className="chart-col relative flex h-full min-w-0 flex-1 items-end justify-center"
                  key={column.label}
                >
                  <span
                    className={`chart-bar block w-full rounded-t-[4px] rounded-b-[2px] ${
                      period === "month" ? "max-w-[18px]" : "max-w-[40px]"
                    } ${
                      column.value === null
                        ? "bg-[#e3e9f1]"
                        : column.current
                          ? "bg-[#1fd2d8]"
                          : "bg-[#253a69]"
                    }`}
                    style={barStyle}
                  />
                  {showTargetMarks ? (
                    <span
                      className="pointer-events-none absolute h-[2px] w-[80%] max-w-[26px] rounded-full bg-[#8fa3c2]"
                      style={{ bottom: `${(column.target / top) * 100}%` }}
                    />
                  ) : null}
                  <span
                    className="chart-tooltip absolute z-10 rounded-[7px] bg-[#14233f] px-2 py-1.5 text-left text-[10px] whitespace-nowrap text-white shadow-[0_10px_25px_rgb(10_25_50/0.18)]"
                    data-align={index === 0 ? "start" : index === lastIndex ? "end" : undefined}
                    style={{ bottom: `calc(${Math.max(height, 3)}% + 6px)` }}
                  >
                    <span className="block font-semibold">
                      {column.label}
                      {column.current ? ` · ${t("revenue.inProgress")}` : ""}
                    </span>
                    <span className="mt-0.5 block text-[#c9d6ea] tabular-nums">
                      {column.value === null ? t("revenue.upcoming") : formatEuro(column.value)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="chart-axis flex h-4 shrink-0 items-end gap-1 sm:gap-2">
            {columns.map((column) => (
              <span
                className={`min-w-0 flex-1 truncate text-center text-[9px] ${
                  column.current ? "font-bold text-[#0e8fa0]" : "font-medium text-[#8a98ab]"
                }`}
                data-current={column.current || undefined}
                key={column.label}
              >
                {column.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{t("revenue.tableCaption", { series: seriesLabel })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("revenue.periodColumn")}</th>
            <th scope="col">{t("revenue.valueColumn")}</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.label}>
              <th scope="row">{column.label}</th>
              <td>{column.value === null ? t("revenue.upcoming") : formatEuro(column.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
