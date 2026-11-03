import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant/client';

export { TenantPrismaClient };

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const POOL_SIZE_PER_TENANT = 5;

interface Entry {
  client: TenantPrismaClient;
  connectionString: string;
  lastUsedAt: number;
}

/**
 * One PrismaClient (and pg pool) per tenant database, created lazily and closed when idle.
 * Put PgBouncer in front of Postgres once the number of tenants grows.
 */
@Injectable()
export class TenantPrismaManager implements OnModuleDestroy {
  private readonly logger = new Logger(TenantPrismaManager.name);
  private readonly clients = new Map<string, Entry>();
  private readonly sweeper = setInterval(() => void this.closeIdle(), 60_000).unref();

  get(tenantId: string, connectionString: string): TenantPrismaClient {
    const entry = this.clients.get(tenantId);
    if (entry?.connectionString === connectionString) {
      entry.lastUsedAt = Date.now();
      return entry.client;
    }
    // Credentials changed (the application role appeared): new requests move over, running ones finish on the old pool
    if (entry) entry.client.$disconnect().catch(() => undefined);
    const client = new TenantPrismaClient({
      adapter: new PrismaPg({ connectionString, max: POOL_SIZE_PER_TENANT }),
    });
    this.clients.set(tenantId, { client, connectionString, lastUsedAt: Date.now() });
    return client;
  }

  async evict(tenantId: string) {
    const entry = this.clients.get(tenantId);
    if (!entry) return;
    this.clients.delete(tenantId);
    await entry.client.$disconnect();
  }

  private async closeIdle() {
    const now = Date.now();
    for (const [tenantId, entry] of this.clients) {
      if (now - entry.lastUsedAt > IDLE_TIMEOUT_MS) {
        this.logger.debug(`Closing idle connection pool for tenant ${tenantId}`);
        await this.evict(tenantId);
      }
    }
  }

  async onModuleDestroy() {
    clearInterval(this.sweeper);
    await Promise.all([...this.clients.keys()].map((id) => this.evict(id)));
  }
}
