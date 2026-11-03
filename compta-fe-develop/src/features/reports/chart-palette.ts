/**
 * Reports chart colors — aligned to Dashboard / Quote semantic hues.
 * Prefer shared tokens; fallbacks match approved Reports mock soft royal blues.
 */

export const reportChart = {
  blueStrong: "#2563EB",
  blue: "#3B82F6",
  blueSoft: "#93C5FD",
  bluePale: "#DBEAFE",
  /** Previous-period comparison bars */
  previous: "#93C5FD",
  /** Current-period revenue bars — soft royal, not navy accent */
  current: "#3B82F6",
  /** Margin line when cost data exists */
  margin: "#7B61C8",
  grid: "#E3EAF3",
  axis: "#8A97AB",
  track: "#EDF2F8",
  green: "#34B979",
  greenSoft: "#A7E8CB",
  amber: "#F3A323",
  amberSoft: "#FDE0A4",
  orange: "#F28A4B",
  red: "#EA5555",
  redSoft: "#F8B4B4",
  gray: "#8A9BB5",
  graySoft: "#DCE4EF",
} as const;

export const agingBucketColor = {
  current: reportChart.green,
  d1_30: reportChart.blue,
  d31_60: reportChart.amber,
  d61_90: reportChart.orange,
  d90_plus: reportChart.red,
} as const;
