import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AccessTokenService } from '../../../common/auth/access-token.service';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { ClientInfo } from '../../../common/http/client-info';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { Prisma } from '../../../generated/control/client';
import { TenantStatus } from '../../../generated/control/enums';
import { AuditService } from '../../audit/audit.service';
import type { AuditActor } from '../../audit/audit.types';
import { TenantDbService } from '../../tenancy/tenant-db.service';
import { TenantRegistryService } from '../../tenancy/tenant-registry.service';
import type { PlatformActor } from '../audit/platform-actor';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { GrantSupportDto } from './dto/grant-support.dto';

const PUBLIC_FIELDS = {
  id: true,
  tenantId: true,
  grantedByEmail: true,
  reason: true,
  platformAdminId: true,
  createdAt: true,
  expiresAt: true,
  revokedAt: true,
} satisfies Prisma.SupportSessionSelect;

/** F01 BR-05: the tenant admin opens the door, for a limited time; both sides keep a record of everything. */
@Injectable()
export class SupportSessionsService {
  constructor(
    private readonly control: ControlPrismaService,
    private readonly tenantDb: TenantDbService,
    private readonly registry: TenantRegistryService,
    private readonly tokens: AccessTokenService,
    private readonly platformAudit: PlatformAuditService,
    private readonly tenantAudit: AuditService,
  ) {}

  /** Called on the tenant side. E-PLAT-04: one valid session at a time; a second grant is refused. */
  async grant(dto: GrantSupportDto, actor: AuditActor) {
    const tenantId = this.tenantDb.tenantId;
    const user = await this.tenantDb.client.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { email: true } });
    const now = new Date();
    const session = await this.control.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
      const active = await tx.supportSession.count({ where: { tenantId, revokedAt: null, expiresAt: { gt: now } } });
      if (active > 0) throw new AppException(HttpStatus.CONFLICT, ErrorCode.SUPPORT_SESSION_ACTIVE, 'A support session is already open');
      const created = await tx.supportSession.create({
        data: {
          tenantId,
          grantedById: actor.userId!,
          grantedByEmail: user.email,
          reason: dto.reason,
          createdAt: now,
          expiresAt: new Date(now.getTime() + dto.durationHours * 3_600_000),
        },
        select: PUBLIC_FIELDS,
      });
      const entry = { action: 'support.grant', targetType: 'tenant', targetId: tenantId, after: created };
      await this.platformAudit.record({ email: user.email, ip: actor.ip, userAgent: actor.userAgent }, entry, tx);
      return created;
    });
    await this.tenantAudit.record(
      { ...actor, email: user.email },
      { action: 'support.grant', entity: 'support_session', entityId: session.id, after: session },
    );
    return session;
  }

  list(tenantId: string) {
    return this.control.supportSession.findMany({ where: { tenantId }, select: PUBLIC_FIELDS, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /** Called on the tenant side. Revoking twice is fine; a session of another tenant does not exist. */
  async revoke(id: string, actor: AuditActor) {
    const tenantId = this.tenantDb.tenantId;
    const session = await this.control.supportSession.findFirst({ where: { id, tenantId }, select: PUBLIC_FIELDS });
    if (!session) throw new NotFoundException('Support session not found');
    if (session.revokedAt) return session;
    const user = await this.tenantDb.client.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { email: true } });
    const updated = await this.control.$transaction(async (tx) => {
      const row = await tx.supportSession.update({ where: { id }, data: { revokedAt: new Date() }, select: PUBLIC_FIELDS });
      await this.platformAudit.record(
        { email: user.email, ip: actor.ip, userAgent: actor.userAgent },
        { action: 'support.revoke', targetType: 'tenant', targetId: tenantId, after: row },
        tx,
      );
      return row;
    });
    await this.tenantAudit.record(
      { ...actor, email: user.email },
      { action: 'support.revoke', entity: 'support_session', entityId: id, after: updated },
    );
    return updated;
  }

  /** Called on the platform side: without a valid grant of THIS tenant there is no token. */
  async enter(tenantId: string, actor: PlatformActor, client: ClientInfo) {
    const tenant = await this.control.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    // E-PLAT-06: a suspended tenant is closed to its own users and to support alike; the session stays and works again on reactivation
    if (tenant.status !== TenantStatus.ACTIVE)
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.INVALID_STATUS_TRANSITION, `Tenant is ${tenant.status}`);
    const session = await this.control.supportSession.findFirst({
      where: { tenantId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!session)
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.SUPPORT_SESSION_INVALID, 'This tenant has granted no support access');

    const admin = await this.control.platformAdmin.findUniqueOrThrow({ where: { id: actor.adminId }, select: { id: true, email: true } });
    await this.control.$transaction(async (tx) => {
      await tx.supportSession.updateMany({ where: { id: session.id, platformAdminId: null }, data: { platformAdminId: admin.id } });
      await this.platformAudit.record(
        actor,
        { action: 'support.enter', targetType: 'tenant', targetId: tenantId, after: { sessionId: session.id } },
        tx,
      );
    });
    await this.registry.runIn(tenant, () =>
      this.tenantAudit.recordSafe(
        { type: 'support', userId: admin.id, email: admin.email, ...client },
        { action: 'support.enter', entity: 'support_session', entityId: session.id },
      ),
    );
    const expiresIn = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
    return {
      accessToken: await this.tokens.signSupport({ sub: admin.id, tid: tenantId, ssn: session.id, email: admin.email }, expiresIn),
      tokenType: 'Bearer',
      expiresIn,
      session: { id: session.id, expiresAt: session.expiresAt },
      tenant: { id: tenant.id, subdomain: tenant.subdomain },
    };
  }
}
