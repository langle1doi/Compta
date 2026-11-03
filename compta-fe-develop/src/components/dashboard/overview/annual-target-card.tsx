"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CountUp } from "@/components/count-up";
import { formatEuro, formatEuroCompact, formatPercent } from "@/lib/money";
import { annualPlan, annualTargetRate, fiscalYear } from "@/mocks/dashboard";

import { CardHeader, DemoTag, LegendDot } from "./dashboard-card";
import { useRevealOnce } from "./use-reveal-once";

export function AnnualTargetCard({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const t = useTranslations("overview");
  const [ref, revealed] = useRevealOnce<HTMLDivElement>();
  const scale = Math.max(...annualPlan.map((entry) => Math.max(entry.realized, entry.target))) * 1.04;
  const [visible, setVisible] = useState({ realized: true, target: true });
  const showRealized = visible.realized;
  const showTarget = visible.target;

  const toggle = (series: keyof typeof visible) =>
    setVisible((current) => {
      const next = { ...current, [series]: !current[series] };
      return next.realized || next.target ? next : current;
    });

  return (
    <section
      aria-labelledby="annual-target-title"
      className={`dashboard-card dashboard-enter flex min-h-[200px] flex-col px-3.5 py-3 xl:h-full xl:min-h-0 ${className}`}
      style={style}
    >
      <CardHeader
        meta={<DemoTag hint={t("demoHint")} label={t("demo")} />}
        title={t("target.title")}
        titleId="annual-target-title"
      />

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="text-[22px] leading-none font-bold tracking-[-0.03em] text-[#102342] tabular-nums">
          <CountUp value={formatPercent(annualTargetRate)} />
        </strong>
        <span className="text-[10px] text-[#7a899e]">{t("target.achieved", { year: fiscalYear })}</span>
        <span className="ml-auto flex gap-x-2.5">
          <SeriesSwitch
            checked={showRealized}
            label={t("target.realized")}
            marker={<LegendDot color="#253a69" />}
            onToggle={() => toggle("realized")}
          />
          <SeriesSwitch
            checked={showTarget}
            label={t("target.goal")}
            marker={<span className="h-2.5 w-[2px] rounded-full bg-[#13284a]" />}
            onToggle={() => toggle("target")}
          />
        </span>
      </div>

      <div className="mt-1.5 flex min-h-0 flex-1 flex-col justify-around" data-revealed={revealed} ref={ref}>
        {annualPlan.map((entry, index) => {
          const realizedWidth = (entry.realized / scale) * 100;
          const targetLeft = (entry.target / scale) * 100;

          return (
            <div className="flex min-h-[40px] flex-col justify-center" key={entry.year}>
              <p className="sr-only">
                {t("target.row", {
                  year: entry.year,
                  realized: formatEuro(entry.realized),
                  target: formatEuro(entry.target),
                })}
              </p>
              <div aria-hidden="true">
                <div className="flex items-baseline justify-between gap-3 text-[10px]">
                  <span className="font-semibold text-[#13284a]">
                    {entry.year}
                    {entry.inProgress ? (
                      <span className="ml-1 font-normal text-[#7a899e]">{t("target.toDate")}</span>
                    ) : null}
                  </span>
                  <span className="truncate text-[#7a899e] tabular-nums">
                    {showRealized ? (
                      <span className="font-semibold text-[#13284a]">{formatEuroCompact(entry.realized)}</span>
                    ) : null}
                    {showRealized && showTarget ? " / " : null}
                    {showTarget ? formatEuroCompact(entry.target) : null}
                  </span>
                </div>
                <div className="relative mt-1.5 h-[5px] rounded-full bg-[#e8eef6]">
                  <span
                    className={`progress-fill series-fade absolute inset-y-0 left-0 rounded-full ${
                      entry.inProgress ? "bg-[#1fd2d8]" : "bg-[#253a69]"
                    }`}
                    data-hidden={!showRealized}
                    style={
                      {
                        width: `${realizedWidth}%`,
                        "--fill-delay": `${120 + index * 60}ms`,
                      } as CSSProperties
                    }
                  />
                  <span
                    className="series-fade absolute -top-[3px] -bottom-[3px] w-[2px] rounded-full bg-[#13284a]"
                    data-hidden={!showTarget}
                    style={{ left: `calc(${targetLeft}% - 1px)` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}

function SeriesSwitch({
  checked,
  label,
  marker,
  onToggle,
}: {
  checked: boolean;
  label: string;
  marker: ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      className="series-switch inline-flex items-center gap-1 text-[9px] text-[#7a899e]"
      onClick={onToggle}
      role="switch"
      type="button"
    >
      {marker}
      {label}
      <span aria-hidden="true" className="series-switch__track">
        <span className="series-switch__knob" />
      </span>
    </button>
  );
}
