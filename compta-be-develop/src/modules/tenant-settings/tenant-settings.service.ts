import { Injectable } from '@nestjs/common';
import { fieldError } from '../../common/errors/app.exception';
import { ControlEventsService } from '../../database/control-events.service';
import { ControlPrismaService } from '../../database/control-prisma.service';
import { CompanyStatus } from '../../generated/tenant/enums';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';

@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly control: ControlPrismaService,
    private readonly events: ControlEventsService,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const settings = await this.tenantDb.client.tenantSetting.findUniqueOrThrow({ where: { id: 1 }, select: { mfaRequiredForAll: true } });
    return { mfaRequired: settings.mfaRequiredForAll, defaultCompanyId: this.tenantDb.context.defaultCompanyId };
  }

  /** F02 BR-03 and the company selected at login. Applies at the next request of every user. */
  async update(dto: UpdateTenantSettingsDto, actor: AuditActor) {
    const { tenantId, subdomain } = this.tenantDb.context;
    const db = this.tenantDb.client;
    const before = await this.get();
    if (dto.defaultCompanyId) {
      const company = await db.company.findFirst({
        where: { id: dto.defaultCompanyId, status: CompanyStatus.ACTIVE },
        select: { id: true },
      });
      if (!company) throw fieldError('default_company_id', 'notFound', 'Unknown or inactive company');
    }
    await db.$transaction(async (tx) => {
      if (dto.mfaRequired !== undefined) await tx.tenantSetting.update({ where: { id: 1 }, data: { mfaRequiredForAll: dto.mfaRequired } });
      await this.audit.record(
        actor,
        { action: 'tenant.settings_updated', entity: 'tenant_settings', entityId: tenantId, before, after: dto },
        tx,
      );
    });
    if (dto.defaultCompanyId)
      await this.control.tenant.update({ where: { id: tenantId }, data: { defaultCompanyId: dto.defaultCompanyId } });
    await this.events.publish({ kind: 'policy', tenantId });
    await this.events.publish({ kind: 'tenant', tenantId, subdomain });
    return { mfaRequired: dto.mfaRequired ?? before.mfaRequired, defaultCompanyId: dto.defaultCompanyId ?? before.defaultCompanyId };
  }
}
