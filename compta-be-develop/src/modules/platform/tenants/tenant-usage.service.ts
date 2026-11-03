import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { ADVISORY_LOCKS, withAdvisoryLock } from '../../../database/advisory-lock';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { Tenant, TenantUsageSnapshot } from '../../../generated/control/client';
import { TenantStatus } from '../../../generated/control/enums';
import { StorageService } from '../../storage/storage.service';
import { TenantRegistryService } from '../../tenancy/tenant-registry.service';

/** F01 I.6: counts shown to the Super Admin may be this old. */
export const USAGE_MAX_AGE_MS = 15 * 60 * 1000;
const READ_TIMEOUT_MS = 5_000;

const withTimeout = <T>(work: Promise<T>) =>
  Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Storage usage read timed out')), READ_TIMEOUT_MS).unref()),
  ]);

/**
 * Usage snapshots: listing tenants reads this table and never opens a tenant database, so its cost does not grow with
 * the number of tenants and one broken database cannot break it. A tenant that cannot be read has no snapshot: usage null.
 */
@Injectable()
export class TenantUsageService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantUsageService.name);
  private timer?: NodeJS.Timeout;
  private round?: Promise<number>;
  private stopping = false;

  constructor(
    private readonly control: ControlPrismaService,
    private readonly registry: TenantRegistryService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /** Starts with a round right away: after a deployment the list must not wait 15 minutes to show anything. */
  startSchedule() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.round = this.refreshAll();
    }, USAGE_MAX_AGE_MS).unref();
    this.round = this.refreshAll();
  }

  async onModuleDestroy() {
    this.stopping = true;
    clearInterval(this.timer);
    await this.round;
  }

  /**
   * One pod at a time; the others skip this round. One tenant at a time on one short connection, so its cost in connections
   * does not grow with the number of tenants; a tenant that cannot be read ends with no snapshot, the others go on.
   * Returns the tenants read, 0 when another pod has the round. Never throws: it runs from a timer.
   */
  async refreshAll() {
    try {
      const { result } = await withAdvisoryLock(this.config.getOrThrow<string>('CONTROL_DATABASE_URL'), ADVISORY_LOCKS.USAGE, async () => {
        const tenants = await this.control.tenant.findMany({ where: { status: { in: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED] } } });
        for (const tenant of tenants) {
          if (this.stopping) break;
          await this.refresh(tenant);
        }
        return tenants.length;
      });
      return result ?? 0;
    } catch (error) {
      this.logger.warn({ code: (error as { code?: string }).code }, 'Usage refresh did not run');
      return 0;
    }
  }

  /** For the detail page: a snapshot older than 15 minutes is refreshed first. */
  async current(tenant: Tenant, snapshot: TenantUsageSnapshot | null): Promise<TenantUsageSnapshot | null> {
    const live = tenant.status === TenantStatus.ACTIVE || tenant.status === TenantStatus.SUSPENDED;
    if (!live || (snapshot && Date.now() - snapshot.capturedAt.getTime() < USAGE_MAX_AGE_MS)) return snapshot;
    return this.refresh(tenant);
  }

  async refresh(tenant: Tenant): Promise<TenantUsageSnapshot | null> {
    try {
      const [counts, filesBytes] = await Promise.all([this.readCounts(tenant), withTimeout(this.storage.tenantUsage(tenant.id))]);
      const { users, companies, invoicesThisMonth, databaseBytes } = counts;
      const data = {
        users,
        companies,
        invoicesThisMonth,
        // max_storage_gb is what the tenant occupies on the platform, not only its files
        storageBytes: databaseBytes + BigInt(filesBytes),
        databaseBytes,
        filesBytes: BigInt(filesBytes),
        capturedAt: new Date(),
      };
      return await this.control.tenantUsageSnapshot.upsert({
        where: { tenantId: tenant.id },
        create: { tenantId: tenant.id, ...data },
        update: data,
      });
    } catch (error) {
      this.logger.warn({ tenantId: tenant.id, code: (error as { code?: string }).code }, 'Could not read tenant usage');
      await this.control.tenantUsageSnapshot.deleteMany({ where: { tenantId: tenant.id } }).catch(() => undefined);
      return null;
    }
  }

  /**
   * Its own short connection, not the tenant's pool: going through every tenant with pools would keep several idle
   * connections per tenant open and exhaust the server's max_connections (E-INF-06).
   */
  private async readCounts(tenant: Tenant) {
    const client = new Client({
      connectionString: this.registry.connectionString(tenant),
      connectionTimeoutMillis: READ_TIMEOUT_MS,
      query_timeout: READ_TIMEOUT_MS,
    });
    await client.connect();
    try {
      const { rows } = await client.query<{ users: number; companies: number; invoices_this_month: number; database_bytes: string }>(
        `SELECT (SELECT count(*)::int FROM users WHERE status = 'ACTIVE') AS users,
                (SELECT count(*)::int FROM companies WHERE status = 'ACTIVE') AS companies,
                (SELECT count(*)::int FROM invoices WHERE status = 'VALIDATED' AND issue_date >= date_trunc('month', now() AT TIME ZONE 'UTC')) AS invoices_this_month,
                pg_database_size(current_database()) AS database_bytes`,
      );
      const [row] = rows;
      return {
        users: row.users,
        companies: row.companies,
        invoicesThisMonth: row.invoices_this_month,
        databaseBytes: BigInt(row.database_bytes),
      };
    } finally {
      await client.end();
    }
  }
}
