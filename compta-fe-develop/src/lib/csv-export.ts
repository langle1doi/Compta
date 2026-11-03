/** Browser CSV download helpers for COMPTE list exports (mock-ready → API later). */

export type CsvCell = string | number | boolean | null | undefined;

function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Plain euro amount for spreadsheets, e.g. `15300.00`. */
export function centsToCsvEuro(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  // UTF-8 BOM helps Excel open accented FR/EN labels correctly.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvCell[][],
): { rowCount: number } {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { rowCount: rows.length };
}

export function mockExportFilename(moduleSlug: string, stamp = new Date()): string {
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  return `compte-${moduleSlug}-mock-${y}${m}${d}.csv`;
}

export function exportFilename(moduleSlug: string, stamp = new Date()): string {
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  return `compte-${moduleSlug}-${y}${m}${d}.csv`;
}
