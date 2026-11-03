import {
  addMonths,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";

import { ledgerToday } from "@/features/quotes/model";

import type { DateRange, ReportGranularity, ReportPeriodPreset } from "./model";

function iso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function clampEnd(end: Date, today: Date) {
  return end > today ? today : end;
}

export function reportAsOf(today = ledgerToday) {
  return parseISO(today);
}

export function resolvePeriodRange(
  preset: ReportPeriodPreset,
  todayIso = ledgerToday,
): DateRange {
  const today = reportAsOf(todayIso);

  switch (preset) {
    case "this_month": {
      const start = startOfMonth(today);
      const end = clampEnd(endOfMonth(today), today);
      return { start: iso(start), end: iso(end), labelKey: "period.this_month" };
    }
    case "last_month": {
      const ref = subMonths(today, 1);
      return {
        start: iso(startOfMonth(ref)),
        end: iso(endOfMonth(ref)),
        labelKey: "period.last_month",
      };
    }
    case "this_quarter": {
      const start = startOfQuarter(today);
      const end = clampEnd(endOfQuarter(today), today);
      return { start: iso(start), end: iso(end), labelKey: "period.this_quarter" };
    }
    case "last_quarter": {
      const ref = subQuarters(today, 1);
      return {
        start: iso(startOfQuarter(ref)),
        end: iso(endOfQuarter(ref)),
        labelKey: "period.last_quarter",
      };
    }
    case "this_year": {
      const start = startOfYear(today);
      const end = clampEnd(endOfYear(today), today);
      return { start: iso(start), end: iso(end), labelKey: "period.this_year" };
    }
    case "previous_year": {
      const ref = subYears(today, 1);
      return {
        start: iso(startOfYear(ref)),
        end: iso(endOfYear(ref)),
        labelKey: "period.previous_year",
      };
    }
  }
}

/** Equivalent previous period of the same length/shape. */
export function resolvePreviousPeriodRange(
  preset: ReportPeriodPreset,
  todayIso = ledgerToday,
): DateRange {
  const today = reportAsOf(todayIso);

  switch (preset) {
    case "this_month":
      return resolvePeriodRange("last_month", todayIso);
    case "last_month": {
      const ref = subMonths(today, 2);
      return {
        start: iso(startOfMonth(ref)),
        end: iso(endOfMonth(ref)),
        labelKey: "period.previous_compare",
      };
    }
    case "this_quarter":
      return resolvePeriodRange("last_quarter", todayIso);
    case "last_quarter": {
      const ref = subQuarters(today, 2);
      return {
        start: iso(startOfQuarter(ref)),
        end: iso(endOfQuarter(ref)),
        labelKey: "period.previous_compare",
      };
    }
    case "this_year":
      return resolvePeriodRange("previous_year", todayIso);
    case "previous_year": {
      const ref = subYears(today, 2);
      return {
        start: iso(startOfYear(ref)),
        end: iso(endOfYear(ref)),
        labelKey: "period.previous_compare",
      };
    }
  }
}

export function isDateInRange(isoDate: string, range: DateRange) {
  return isoDate >= range.start && isoDate <= range.end;
}

export function periodBucketKey(isoDate: string, granularity: ReportGranularity) {
  const date = parseISO(isoDate);
  if (granularity === "yearly") return format(date, "yyyy");
  if (granularity === "quarterly") {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${format(date, "yyyy")}-Q${quarter}`;
  }
  return format(date, "yyyy-MM");
}

export function periodBucketLabel(key: string, granularity: ReportGranularity) {
  if (granularity === "yearly") return key;
  if (granularity === "quarterly") return key.replace("-", " ");
  const date = parseISO(`${key}-01`);
  return format(date, "MMM yyyy");
}

/** Build consecutive bucket keys covering the selected range. */
export function enumerateBuckets(range: DateRange, granularity: ReportGranularity) {
  const keys: string[] = [];
  let cursor = parseISO(range.start);
  const end = parseISO(range.end);

  while (cursor <= end) {
    const key = periodBucketKey(iso(cursor), granularity);
    if (keys[keys.length - 1] !== key) keys.push(key);
    cursor =
      granularity === "yearly"
        ? addMonths(cursor, 12)
        : granularity === "quarterly"
          ? addMonths(cursor, 3)
          : addMonths(cursor, 1);
  }

  if (keys.length === 0) {
    keys.push(periodBucketKey(range.start, granularity));
  }
  return keys;
}

export function filenamePeriodStamp(range: DateRange) {
  return range.start.slice(0, 7);
}
