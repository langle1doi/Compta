import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ADVISORY_LOCKS, withAdvisoryLock } from '../../../database/advisory-lock';
import { ControlEventsService } from '../../../database/control-events.service';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { TenantPrismaManager } from '../../../database/tenant-prisma.manager';
import { Tenant } from '../../../generated/control/client';
import { TenantStatus } from '../../../generated/control/enums';
import { StorageService, tenantPrefix } from '../../storage/storage.service';
import { SYSTEM_ACTOR } from '../audit/platform-actor';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { TenantProvisionerService } from '../tenants/tenant-provisioner.service';
import { PURGE_AFTER_MS } from '../tenants/tenants.service';
import { TenantExportsService } from './tenant-exports.service';

const RUN_EVERY_MS = 60 * 60 * 1000;

export interface PurgeRun {
  ran: boolean;
  purged: string[];
  skipped: string[];
  failed: string[];
}

/**
 * F01 BR-06: DELETED for 30 days and with a data export: its files, database and roles go, then its row, which frees the
 * subdomain (E-TEN-10). Off unless TENANT_PURGE_ENABLED=true. The audit log outlives the tenant.
 */
@Injectable()
export class TenantPurgeService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantPurgeService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly control: ControlPrismaService,
    private readonly exports: TenantExportsService,
    private readonly storage: StorageService,
    private readonly provisioner: TenantProvisionerService,
    private readonly manager: TenantPrismaManager,
    private readonly audit: PlatformAuditService,
    private readonly events: ControlEventsService,
    private readonly config: ConfigService,
  ) {}

  startSchedule() {
    if (!this.config.get<boolean>('TENANT_PURGE_ENABLED')) return;
    this.timer ??= setInterval(
      () => void this.run().catch((error: Error) => this.logger.error({ err: error }, 'Purge failed')),
      RUN_EVERY_MS,
    ).unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** One pod at a time; the others skip this round. */
  async run(now = new Date()): Promise<PurgeRun> {
    const outcome: PurgeRun = { ran: false, purged: [], skipped: [], failed: [] };
    if (!this.config.get<boolean>('TENANT_PURGE_ENABLED')) return outcome;
    const { ran } = await withAdvisoryLock(this.config.getOrThrow<string>('CONTROL_DATABASE_URL'), ADVISORY_LOCKS.PURGE, async () => {
      const due = await this.control.tenant.findMany({
        where: { status: TenantStatus.DELETED, deletedAt: { lte: new Date(now.getTime() - PURGE_AFTER_MS) } },
      });
      for (const tenant of due) await this.purgeOne(tenant, outcome);
    });
    outcome.ran = ran;
    return outcome;
  }

  private async purgeOne(tenant: Tenant, outcome: PurgeRun) {
    try {
      if (!(await this.exports.hasFinalExport(tenant))) {
        this.logger.warn({ tenantId: tenant.id }, 'Tenant is due for purge but has no data export, keeping it');
        outcome.skipped.push(tenant.subdomain);
        return;
      }
      await this.manager.evict(tenant.id);
      await this.storage.deletePrefix(tenantPrefix(tenant.id));
      await this.provisioner.dropActivatedDatabase(tenant.id, tenant.dbName, tenant.dbUser);
      await this.control.$transaction(async (tx) => {
        // The row must still be DELETED: nothing else may have happened to it meanwhile (E-EXP-07)
        const { count } = await tx.tenant.deleteMany({ where: { id: tenant.id, status: TenantStatus.DELETED } });
        if (count === 0) throw new Error('Tenant changed during purge');
        await this.audit.record(
          SYSTEM_ACTOR,
          {
            action: 'tenant.purge',
            targetType: 'tenant',
            targetId: tenant.id,
            before: { name: tenant.name, subdomain: tenant.subdomain, deletedAt: tenant.deletedAt },
          },
          tx,
        );
      });
      await this.events.publish({ kind: 'tenant', tenantId: tenant.id, subdomain: tenant.subdomain });
      this.logger.log({ tenantId: tenant.id, subdomain: tenant.subdomain }, 'Tenant purged');
      outcome.purged.push(tenant.subdomain);
    } catch (error) {
      // E-EXP-07: the next round starts over, every step can run twice
      this.logger.error({ err: error, tenantId: tenant.id }, 'Tenant purge failed, will try again');
      outcome.failed.push(tenant.subdomain);
    }
  }
}
