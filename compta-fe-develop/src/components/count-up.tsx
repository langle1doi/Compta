"use client";

import { useLayoutEffect, useState } from "react";

type ParsedMetric = {
  target: number;
  decimals: number;
  suffix: string;
};

function parseMetric(value: string): ParsedMetric | null {
  const match = value.trim().match(/^(\d(?:[\d\s]*\d)?(?:,\d+)?)(.*)$/);
  if (!match) return null;

  const raw = match[1].trim();
  const target = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(target)) return null;

  return {
    target,
    decimals: raw.includes(",") ? (raw.split(",")[1]?.length ?? 0) : 0,
    suffix: match[2],
  };
}

function formatMetric(amount: number, decimals: number, suffix: string) {
  const [whole, fraction] = amount.toFixed(decimals).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped},${fraction}${suffix}` : `${grouped}${suffix}`;
}

export function CountUp({
  value,
  duration = 680,
}: {
  value: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);

  useLayoutEffect(() => {
    const parsed = parseMetric(value);
    if (!parsed) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const startLoop = (startedAt: number) => {
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        if (progress >= 1) {
          setDisplay(value);
          return;
        }

        const eased = 1 - (1 - progress) ** 3;
        setDisplay(
          formatMetric(parsed.target * eased, parsed.decimals, parsed.suffix),
        );
        frame = requestAnimationFrame(tick);
      };

      setDisplay(formatMetric(0, parsed.decimals, parsed.suffix));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(startLoop);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return display;
}
