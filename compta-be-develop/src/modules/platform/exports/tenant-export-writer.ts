import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';
import { Client } from 'pg';
import { ZipFile } from 'yazl';

const CURSOR_BATCH = 1000;

// Nothing of what lets someone log in leaves the platform (E-EXP-01). Applied to every table, also those added later.
const SENSITIVE_TABLE = /session|refresh|password|invitation|mfa|recovery|idempotency|_prisma_migrations/i;
const SENSITIVE_COLUMN = /password|hash|secret|token|_enc$|mfa|recovery_code/i;

export const isExportedTable = (table: string) => !SENSITIVE_TABLE.test(table);
export const isExportedColumn = (column: string) => !SENSITIVE_COLUMN.test(column);

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export interface ExportedTable {
  table: string;
  rows: number;
}

/**
 * Writes one NDJSON file per table and zips them, in a single read-only snapshot so the export is consistent (E-EXP-03).
 * Rows go through a cursor to disk: memory does not grow with the data (E-EXP-02).
 */
export async function writeTenantExport(
  connectionString: string,
  dir: string,
  zipPath: string,
  onTable: (table: string) => Promise<void> = () => Promise.resolve(),
): Promise<ExportedTable[]> {
  const client = new Client({ connectionString });
  await client.connect();
  const zip = new ZipFile();
  const tables: ExportedTable[] = [];
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
    );
    for (const { table_name: table } of rows.filter((r) => isExportedTable(r.table_name))) {
      const columns = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      );
      const selected = columns.rows.map((c) => c.column_name).filter(isExportedColumn);
      if (selected.length === 0) continue;

      const file = join(dir, `${table}.ndjson`);
      const out = createWriteStream(file);
      let count = 0;
      await client.query(`DECLARE export_rows NO SCROLL CURSOR FOR SELECT ${selected.map(quote).join(', ')} FROM ${quote(table)}`);
      for (;;) {
        const batch = await client.query<Record<string, unknown>>(`FETCH ${CURSOR_BATCH} FROM export_rows`);
        for (const row of batch.rows) {
          if (!out.write(`${JSON.stringify(row)}\n`)) await once(out, 'drain');
        }
        count += batch.rows.length;
        if (batch.rows.length < CURSOR_BATCH) break;
      }
      await client.query('CLOSE export_rows');
      out.end();
      await finished(out);
      zip.addFile(file, `${table}.ndjson`);
      tables.push({ table, rows: count });
      await onTable(table);
    }
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
  zip.addBuffer(Buffer.from(JSON.stringify({ exportedAt: new Date().toISOString(), tables }, null, 2)), 'manifest.json');
  const output = createWriteStream(zipPath);
  zip.outputStream.pipe(output);
  zip.end();
  await finished(output);
  return tables;
}
