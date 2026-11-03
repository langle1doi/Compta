import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { encryptSecret } from '../../common/crypto/secret-box';
import { POSTGRES_IDENTIFIER_MAX } from './reserved-subdomains';

export interface TenantAppRoleParams {
  /** TENANT_DB_ADMIN_URL: creates the role. */
  adminUrl: string;
  /** Owner connection to the tenant database: gives the grants. */
  ownerUrl: string;
  tenantId: string;
  dbName: string;
  dbUser: string;
  /** DB_CREDENTIALS_KEY */
  key: string;
  /** What the control table holds now; a role with a known password keeps it. */
  current?: { dbAppUser: string | null; dbAppPasswordEnc: string | null };
}

export const ownershipMark = (tenantId: string) => `compte-tenant:${tenantId}`;

export const appRoleName = (dbUser: string) => `${dbUser}_app`;

const quoted = (identifier: string) => {
  if (identifier.length > POSTGRES_IDENTIFIER_MAX || !/^[a-z_][a-z0-9_]*$/.test(identifier))
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
};

const withClient = async <T>(connectionString: string, fn: (client: Client) => Promise<T>): Promise<T> => {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

/**
 * F16 BR-01: the API connects with this role. It owns nothing, so it cannot run DDL, drop a trigger or give itself
 * rights, and on audit_logs it can only INSERT and SELECT. Run after every tenant migration: idempotent, and tables of
 * later migrations are covered by the default privileges. The owner role and a superuser can still change audit_logs.
 *
 * Returns what the caller must store in the control table, in the same step as the migration result.
 */
export async function ensureTenantAppRole(params: TenantAppRoleParams): Promise<{ dbAppUser: string; dbAppPasswordEnc: string }> {
  const { adminUrl, ownerUrl, tenantId, dbName, dbUser, key, current } = params;
  const role = quoted(appRoleName(dbUser));
  const database = quoted(dbName);
  const owner = quoted(dbUser);
  const keep = current?.dbAppUser === appRoleName(dbUser) ? current.dbAppPasswordEnc : null;
  const generated = randomBytes(24).toString('hex');
  const password = keep ? null : generated;

  await withClient(adminUrl, async (admin) => {
    const { rows } = await admin.query<{ mark: string | null }>(
      `SELECT shobj_description(oid, 'pg_authid') AS mark FROM pg_roles WHERE rolname = $1`,
      [appRoleName(dbUser)],
    );
    // E-TEN-04: a role of this name that this tenant did not create is left alone
    if (rows.length > 0 && rows[0].mark !== ownershipMark(tenantId))
      throw new Error('A role with the application role name already exists and does not belong to this tenant');
    // DDL takes no bind parameters: the identifier is checked, the password is hex, the tenant id comes from a uuid column
    if (rows.length === 0) {
      await admin.query('BEGIN');
      await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${generated}' NOCREATEDB NOCREATEROLE NOSUPERUSER`);
      await admin.query(`COMMENT ON ROLE ${role} IS '${ownershipMark(tenantId)}'`);
      await admin.query('COMMIT');
    } else if (password) {
      // The previous attempt died before the control table learned the password
      await admin.query(`ALTER ROLE ${role} PASSWORD '${password}'`);
    }
    await admin.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
  });

  await withClient(ownerUrl, async (db) => {
    await db.query('BEGIN');
    await db.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
    await db.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
    await db.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`);
    await db.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`);
    await db.query(`REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON audit_logs FROM ${role}`);
    await db.query(`REVOKE ALL ON _prisma_migrations FROM ${role}`);
    await db.query('COMMIT');
  });

  return { dbAppUser: appRoleName(dbUser), dbAppPasswordEnc: keep ?? encryptSecret(generated, key) };
}
