import { Client } from 'pg';
import { decryptSecret } from '../../src/common/crypto/secret-box';

/** Every tenant created by the e2e suite (besides the default "dfm") uses this subdomain prefix. */
export const E2E_PREFIX = 'e2e-';

async function withClient<T>(connectionString: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export const withAdmin = <T>(fn: (c: Client) => Promise<T>) => withClient(process.env.TENANT_DB_ADMIN_URL!, fn);
export const withControl = <T>(fn: (c: Client) => Promise<T>) => withClient(process.env.CONTROL_DATABASE_URL!, fn);

export interface TenantCredentials {
  id: string;
  dbName: string;
  dbUser: string;
  password: string;
  host: string;
  port: number;
}

/** Real DB credentials of a tenant, read from the control plane (as the API would). */
export async function tenantCredentials(subdomain: string): Promise<TenantCredentials> {
  const { rows } = await withControl((c) =>
    c.query('SELECT id, db_name, db_user, db_password_enc FROM tenants WHERE subdomain = $1', [subdomain]),
  );
  const t = rows[0];
  return {
    id: t.id,
    dbName: t.db_name,
    dbUser: t.db_user,
    password: decryptSecret(t.db_password_enc, process.env.DB_CREDENTIALS_KEY!),
    // Address of the default cluster, as the API resolves it
    host: process.env.TENANT_DB_HOST!,
    port: Number(process.env.TENANT_DB_PORT ?? 5432),
  };
}

/** Connection string as tenant `creds` to database `dbName` (defaults to its own). */
export const tenantUrl = (creds: TenantCredentials, dbName = creds.dbName) =>
  `postgresql://${creds.dbUser}:${encodeURIComponent(creds.password)}@${creds.host}:${creds.port}/${dbName}`;

export const withTenantDb = async <T>(subdomain: string, fn: (c: Client) => Promise<T>) =>
  withClient(tenantUrl(await tenantCredentials(subdomain)), fn);

export const e2eControlDbName = () => new URL(process.env.CONTROL_DATABASE_URL!).pathname.slice(1);

/** Database and role name of a tenant created by this run. */
export const tenantDbNameOf = (subdomain: string) => `${process.env.TENANT_DB_NAME_PREFIX}${subdomain.replace(/-/g, '_')}`;

/**
 * Drops this run's control DB and every <prefix>* database and role (left over or current). Names are matched exactly:
 * a run with another E2E_CONTROL_DB or E2E_TENANT_DB_PREFIX on the same server is left alone.
 */
export async function dropE2eDatabases() {
  const prefix = process.env.TENANT_DB_NAME_PREFIX!;
  const controlDb = e2eControlDbName();
  // Everything matching is dropped: never run this against the names of a real environment
  if (!prefix.includes('e2e') || !controlDb.includes('e2e')) throw new Error('Refusing to drop databases without "e2e" in their name');
  const pattern = `${prefix.replace(/_/g, '\\_')}%`;
  await withAdmin(async (admin) => {
    const dbs = await admin.query('SELECT datname FROM pg_database WHERE datname LIKE $1 OR datname = $2', [pattern, controlDb]);
    for (const { datname } of dbs.rows) await admin.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    const roles = await admin.query('SELECT rolname FROM pg_roles WHERE rolname LIKE $1', [pattern]);
    for (const { rolname } of roles.rows) await admin.query(`DROP ROLE IF EXISTS "${rolname}"`);
  });
}
