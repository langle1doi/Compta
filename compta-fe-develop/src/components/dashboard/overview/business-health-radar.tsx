"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

import { formatPercent } from "@/lib/money";
import { businessHealth } from "@/mocks/dashboard";

import { CardHeader } from "./dashboard-card";
import { useRevealOnce } from "./use-reveal-once";

const axes = ["conversion", "collection", "onTime", "target"] as const;

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 78;

/** Axes run clockwise from the top: top, right, bottom, left. */
function point(axisIndex: number, ratio: number) {
  const angle = -Math.PI / 2 + (axisIndex * Math.PI) / 2;
  return {
    x: CENTER + Math.cos(angle) * RADIUS * ratio,
    y: CENTER + Math.sin(angle) * RADIUS * ratio,
  };
}

const toPoints = (ratios: number[]) =>
  ratios
    .map((ratio, index) => {
      const { x, y } = point(index, ratio);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

export function BusinessHealthRadar({ style }: { style?: CSSProperties }) {
  const t = useTranslations("overview");
  const [ref, revealed] = useRevealOnce<HTMLDivElement>();
  const values = axes.map((axis) => Math.min(1, Math.max(0, businessHealth[axis])));

  return (
    <section
      aria-labelledby="business-health-title"
      className="dashboard-card dashboard-enter flex min-h-[220px] flex-col px-3.5 py-3 lg:h-full lg:min-h-0"
      style={style}
    >
      <CardHeader title={t("health.title")} titleId="business-health-title" />
      <p className="dashboard-label mt-0.5 truncate" title={t("health.hint")}>{t("health.hint")}</p>

      <div
        className="mt-1.5 grid min-h-0 flex-1 grid-cols-[42%_minmax(0,1fr)] items-center gap-2.5"
        data-revealed={revealed}
        ref={ref}
      >
        <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[120px] p-[6%]">
          <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {[0.25, 0.5, 0.75, 1].map((ring) => (
              <polygon
                fill={ring === 1 ? "rgb(247 250 253)" : "none"}
                key={ring}
                points={toPoints(axes.map(() => ring))}
                stroke="#c8d4e4"
                strokeWidth={1}
              />
            ))}
            {axes.map((axis, index) => {
              const end = point(index, 1);
              return (
                <line
                  key={axis}
                  stroke="#c8d4e4"
                  strokeWidth={1}
                  x1={CENTER}
                  x2={end.x}
                  y1={CENTER}
                  y2={end.y}
                />
              );
            })}
            <polygon
              className="radar-shape"
              fill="rgb(36 211 225 / 0.22)"
              points={toPoints(values)}
              stroke="#20bcce"
              strokeLinejoin="round"
              strokeWidth={2}
            />
            {values.map((value, index) => {
              const { x, y } = point(index, value);
              return (
                <circle
                  className="radar-point"
                  cx={x}
                  cy={y}
                  fill="#1746b8"
                  key={axes[index]}
                  r={6}
                  stroke="#fff"
                  strokeWidth={2}
                  style={{ "--point-delay": `${280 + index * 40}ms` } as CSSProperties}
                />
              );
            })}
          </svg>
        </div>

        <dl className="grid min-w-0 gap-1">
          {axes.map((axis, index) => (
            <div
              className="soft-row grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 rounded-[7px] bg-[#f5f8fc] px-2.5 py-1.5"
              key={axis}
            >
              <dt className="min-w-0 truncate text-[9px] text-[#66758d]">{t(`health.${axis}`)}</dt>
              <dd className="contents">
                <span className="text-[10px] font-bold text-[#13284a] tabular-nums">
                  {formatPercent(values[index])}
                </span>
                <span className="col-span-2 mt-1 block h-[3px] overflow-hidden rounded-full bg-[#e3eaf3]">
                  <span
                    className="progress-fill block h-full rounded-full bg-[#20bcce]"
                    style={
                      {
                        width: `${values[index] * 100}%`,
                        "--fill-delay": `${200 + index * 40}ms`,
                      } as CSSProperties
                    }
                  />
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
