import { execFile } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const TENANT_MIGRATIONS_DIR = join(PROJECT_ROOT, 'prisma', 'tenant', 'migrations');

// Fixed for the lifetime of a build
let latestVersion: string | undefined;

/** Name of the newest tenant-schema migration shipped with this build, e.g. "20261029075710_foundation_hardening". */
export function latestTenantSchemaVersion(): string {
  latestVersion ??= readdirSync(TENANT_MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .at(-1);
  return latestVersion!;
}

/** Runs `prisma migrate deploy` for the tenant schema against one tenant database; returns the schema version. */
export async function migrateTenantDatabase(connectionString: string): Promise<string> {
  const prismaCli = require.resolve('prisma/build/index.js');
  await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy', '--config', 'prisma.tenant.config.ts'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, TENANT_DATABASE_URL: connectionString, DOTENV_CONFIG_QUIET: 'true' },
    timeout: 5 * 60 * 1000,
  });
  return latestTenantSchemaVersion();
}
