import type { ReportGranularity, RevenuePoint } from "./model";

/** Euro amounts for FE chart QA — continuous series for readable composed chart. */
const monthlyDemoEuro = [
  42_800, 45_120, 48_900, 51_200, 49_750, 52_430, 50_100, 47_800, 53_600, 55_200, 54_100, 56_400,
] as const;

const quarterlyDemoEuro = [128_400, 152_380, 151_500, 110_500] as const;

const yearlyDemoEuro = [412_600, 385_200] as const;

function euroToCents(euro: number) {
  return Math.round(euro * 100);
}

function demoForIndex(granularity: ReportGranularity, index: number) {
  const table =
    granularity === "yearly"
      ? yearlyDemoEuro
      : granularity === "quarterly"
        ? quarterlyDemoEuro
        : monthlyDemoEuro;
  return table[index % table.length];
}

function isBucketEmpty(point: RevenuePoint) {
  return (
    point.revenueCents === 0 &&
    point.previousRevenueCents === 0 &&
    point.marginCents === null &&
    point.marginPercent === null
  );
}

function demoPoint(point: RevenuePoint, granularity: ReportGranularity, index: number): RevenuePoint {
  const revenueEuro = demoForIndex(granularity, index);
  const previousEuro = Math.round(revenueEuro * (0.88 + (index % 5) * 0.025));
  const marginRatio = 0.28 + (index % 4) * 0.015;
  const revenueCents = euroToCents(revenueEuro);
  const previousRevenueCents = euroToCents(previousEuro);
  return {
    ...point,
    revenueCents,
    previousRevenueCents,
    marginCents: Math.round(revenueCents * marginRatio),
    marginPercent: marginRatio,
  };
}

/**
 * Builds a continuous chart series for FE mock when the filtered ledger is sparse.
 * Uses a full demo curve (not a hybrid of real+demo) so bars/line do not break mid-chart.
 * Export / KPI / summary still use the real `points` passed into the report.
 */
export function withRevenueTrendChartDemo(
  points: RevenuePoint[],
  granularity: ReportGranularity,
): { points: RevenuePoint[]; usedDemo: boolean } {
  if (points.length === 0) return { points, usedDemo: false };

  const sparse = points.some(isBucketEmpty);
  const marginBroken = points.some((point) => point.marginPercent === null);

  // Sparse ledger or incomplete margin → continuous demo for chart readability.
  if (!sparse && !marginBroken) {
    return { points, usedDemo: false };
  }

  return {
    points: points.map((point, index) => demoPoint(point, granularity, index)),
    usedDemo: true,
  };
}
