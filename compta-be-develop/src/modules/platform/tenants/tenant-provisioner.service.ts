import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { appRoleName, ownershipMark } from '../../tenancy/tenant-app-role';

export interface TenantDbCredentials {
  dbName: string;
  dbUser: string;
  password: string;
}

const PG_DUPLICATE_OBJECT = '42710';
const PG_DUPLICATE_DATABASE = '42P04';

/** E-TEN-04: the database or role name is already taken by something this tenant did not create. */
export class TenantDbNameConflictError extends Error {
  constructor() {
    super('A database or role with this name already exists and does not belong to this tenant');
  }
}

/**
 * Creates one PostgreSQL database + login role per tenant, using the admin connection.
 * The tenant role owns only its own database; PUBLIC cannot connect to it.
 */
@Injectable()
export class TenantProvisionerService {
  private readonly logger = new Logger(TenantProvisionerService.name);

  constructor(private readonly config: ConfigService) {}

  credentialsFor(subdomain: string): TenantDbCredentials {
    const name = `${this.config.getOrThrow<string>('TENANT_DB_NAME_PREFIX')}${subdomain.replace(/-/g, '_')}`;
    return { dbName: name, dbUser: name, password: randomBytes(24).toString('hex') };
  }

  async createDatabase(tenantId: string, { dbName, dbUser, password }: TenantDbCredentials) {
    assertIdentifier(dbName);
    assertIdentifier(dbUser);
    await this.withAdmin(async (client) => {
      try {
        // Role and mark commit together; CREATE DATABASE cannot run in a transaction, but its owner proves whose it is.
        // DDL cannot take bind parameters; identifiers are validated, the password is hex, the tenant id a uuid.
        await client.query('BEGIN');
        await client.query(`CREATE ROLE "${dbUser}" LOGIN PASSWORD '${password}'`);
        await client.query(`COMMENT ON ROLE "${dbUser}" IS '${ownershipMark(tenantId)}'`);
        await client.query('COMMIT');
        await client.query(`CREATE DATABASE "${dbName}" OWNER "${dbUser}"`);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        const code = (error as { code?: string }).code;
        if (code === PG_DUPLICATE_OBJECT || code === PG_DUPLICATE_DATABASE) throw new TenantDbNameConflictError();
        throw error;
      }
      await client.query(`REVOKE ALL ON DATABASE "${dbName}" FROM PUBLIC`);
    });
    this.logger.log(`Created database ${dbName}`);
  }

  /**
   * Cleanup after a failed or interrupted provisioning of this tenant. Drops only what an attempt for this tenant
   * created: the role if it carries the tenant's mark, the database if that role owns it. Anything else stays (E-TEN-04).
   */
  async dropOwnDatabase(tenantId: string, dbName: string, dbUser: string) {
    assertIdentifier(dbName);
    assertIdentifier(dbUser);
    await this.withAdmin(async (client) => {
      const role = await client.query<{ mark: string | null }>(
        `SELECT shobj_description(oid, 'pg_authid') AS mark FROM pg_roles WHERE rolname = $1`,
        [dbUser],
      );
      if (role.rows[0]?.mark !== ownershipMark(tenantId)) {
        if (role.rows.length > 0) this.logger.warn({ tenantId, dbUser }, 'Role of this name is not ours, leaving it and its database');
        return;
      }
      const database = await client.query<{ owner: string }>(
        'SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
        [dbName],
      );
      if (database.rows[0]?.owner === dbUser) {
        await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      } else if (database.rows.length > 0) {
        this.logger.warn({ tenantId, dbName }, 'Database of this name is not ours, leaving it');
      }
      // After the database: that is where its grants live
      await this.dropAppRole(client, tenantId, dbUser);
      await client.query(`DROP ROLE IF EXISTS "${dbUser}"`);
    });
  }

  /**
   * Purge of a tenant that reached ACTIVE, so its role is known to be its own even when it predates the ownership mark.
   * A role carrying another tenant's mark is still left alone.
   */
  async dropActivatedDatabase(tenantId: string, dbName: string, dbUser: string) {
    assertIdentifier(dbUser);
    await this.withAdmin(async (client) => {
      const { rows } = await client.query<{ mark: string | null }>(
        `SELECT shobj_description(oid, 'pg_authid') AS mark FROM pg_roles WHERE rolname = $1`,
        [dbUser],
      );
      if (rows.length > 0 && rows[0].mark === null) await client.query(`COMMENT ON ROLE "${dbUser}" IS '${ownershipMark(tenantId)}'`);
    });
    await this.dropOwnDatabase(tenantId, dbName, dbUser);
  }

  private async dropAppRole(client: Client, tenantId: string, dbUser: string) {
    const appRole = appRoleName(dbUser);
    assertIdentifier(appRole);
    const { rows } = await client.query<{ mark: string | null }>(
      `SELECT shobj_description(oid, 'pg_authid') AS mark FROM pg_roles WHERE rolname = $1`,
      [appRole],
    );
    if (rows[0]?.mark === ownershipMark(tenantId)) await client.query(`DROP ROLE "${appRole}"`);
  }

  private async withAdmin<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: this.config.getOrThrow<string>('TENANT_DB_ADMIN_URL') });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }
}

function assertIdentifier(value: string) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
}
