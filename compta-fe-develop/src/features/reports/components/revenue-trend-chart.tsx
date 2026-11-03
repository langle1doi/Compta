"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoneyFromCents } from "@/lib/money";

import { reportChart } from "../chart-palette";
import type { ReportTrendMetric, RevenuePoint } from "../model";

type ChartRow = {
  label: string;
  revenue: number;
  previous: number;
  marginPct: number | null;
  revenueCents: number;
  previousRevenueCents: number;
  marginPercent: number | null;
};

type TooltipPayloadItem = {
  payload?: ChartRow;
};

function RevenueTooltip({
  active,
  payload,
  label,
  labels,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  labels: { current: string; previous: string; marginPct: string; period: string };
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="report-chart-tooltip max-w-[min(240px,calc(100vw-2rem))]">
      <p className="text-[10px] font-medium text-[#7a899e]">{labels.period}</p>
      <p className="mt-0.5 text-[12px] font-semibold text-[#132642]">{String(label)}</p>
      <dl className="mt-2 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-[11px] text-[#66758d]">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ backgroundColor: reportChart.current }}
            />
            {labels.current}
          </dt>
          <dd className="text-[11px] font-semibold text-[#132642] tabular-nums">
            {formatMoneyFromCents(row.revenueCents)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-[11px] text-[#66758d]">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ backgroundColor: reportChart.previous }}
            />
            {labels.previous}
          </dt>
          <dd className="text-[11px] font-semibold text-[#516078] tabular-nums">
            {formatMoneyFromCents(row.previousRevenueCents)}
          </dd>
        </div>
        {row.marginPercent !== null ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-[11px] text-[#66758d]">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: reportChart.margin }}
              />
              {labels.marginPct}
            </dt>
            <dd className="text-[11px] font-semibold text-[#516078] tabular-nums">
              {(row.marginPercent * 100).toFixed(1)}%
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function RevenueTrendChart({
  points,
  metric: _metric,
  labels,
}: {
  points: RevenuePoint[];
  metric: ReportTrendMetric;
  labels: {
    current: string;
    previous: string;
    marginPct: string;
    period: string;
  };
}) {
  const chartData: ChartRow[] = points.map((point) => ({
    label: point.label,
    revenue: point.revenueCents / 100,
    previous: point.previousRevenueCents / 100,
    marginPct: point.marginPercent === null ? null : point.marginPercent * 100,
    revenueCents: point.revenueCents,
    previousRevenueCents: point.previousRevenueCents,
    marginPercent: point.marginPercent,
  }));

  // Only draw margin when every bucket has a value — avoids a broken mid-chart line.
  const drawMarginLine =
    points.length > 0 && points.every((point) => point.marginPercent !== null);

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
      <ComposedChart
        barCategoryGap="22%"
        barGap={3}
        data={chartData}
        margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
      >
        <CartesianGrid
          stroke={reportChart.grid}
          strokeDasharray="3 3"
          strokeOpacity={0.55}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          interval="preserveStartEnd"
          minTickGap={20}
          tick={{ fill: reportChart.axis, fontSize: 11, fontFamily: "inherit" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: reportChart.axis, fontSize: 11, fontFamily: "inherit" }}
          axisLine={false}
          tickLine={false}
          width={40}
          tickFormatter={(value: number) =>
            value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value))
          }
        />
        {drawMarginLine ? (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: reportChart.axis, fontSize: 11, fontFamily: "inherit" }}
            axisLine={false}
            tickLine={false}
            width={34}
            unit="%"
          />
        ) : null}
        <Tooltip
          cursor={{ fill: "rgb(59 130 246 / 0.06)" }}
          content={(props) => (
            <RevenueTooltip
              active={props.active}
              label={props.label}
              labels={labels}
              payload={props.payload as TooltipPayloadItem[] | undefined}
            />
          )}
          wrapperStyle={{ outline: "none", zIndex: 20 }}
        />
        <Legend
          align="center"
          verticalAlign="bottom"
          height={28}
          content={({ payload }) => (
            <ul className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 pb-0.5">
              {(payload ?? [])
                .filter((entry) => {
                  if (entry.dataKey === "marginPct" && !drawMarginLine) return false;
                  return true;
                })
                .map((entry) => (
                  <li
                    className="inline-flex items-center gap-1.5 text-[11px] text-[#66758d]"
                    key={String(entry.value)}
                  >
                    <span
                      aria-hidden="true"
                      className={
                        entry.dataKey === "marginPct"
                          ? "inline-block h-1.5 w-3 rounded-full"
                          : "inline-block h-2 w-2 rounded-[2px]"
                      }
                      style={{ backgroundColor: String(entry.color) }}
                    />
                    {entry.value}
                  </li>
                ))}
            </ul>
          )}
        />
        <Bar
          yAxisId="left"
          dataKey="revenue"
          name={labels.current}
          fill={reportChart.current}
          radius={[5, 5, 1, 1]}
          maxBarSize={22}
          isAnimationActive
          animationDuration={420}
        />
        <Bar
          yAxisId="left"
          dataKey="previous"
          name={labels.previous}
          fill={reportChart.previous}
          fillOpacity={0.95}
          radius={[5, 5, 1, 1]}
          maxBarSize={22}
          isAnimationActive
          animationDuration={420}
        />
        {drawMarginLine ? (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="marginPct"
            name={labels.marginPct}
            stroke={reportChart.margin}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: reportChart.margin }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive
            animationDuration={420}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
