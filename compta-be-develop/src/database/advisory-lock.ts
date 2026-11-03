import { Client } from 'pg';

/**
 * Runs `fn` only if this process gets the session-level advisory lock; other pods skip the run.
 * A dedicated connection, because a session lock belongs to one connection and Prisma uses a pool.
 * The server releases the lock by itself if the process dies.
 */
export async function withAdvisoryLock<T>(
  connectionString: string,
  key: number,
  fn: () => Promise<T>,
): Promise<{ ran: boolean; result?: T }> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [key]);
    if (!rows[0].locked) return { ran: false };
    return { ran: true, result: await fn() };
  } finally {
    await client.end();
  }
}

export const ADVISORY_LOCKS = {
  PURGE: 7_100_001,
  USAGE: 7_100_002,
  MAIL_SWEEP: 7_100_003,
  JOB_SWEEP: 7_100_004,
  EXPORT_SWEEP: 7_100_005,
} as const;
