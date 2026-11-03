import { Injectable } from '@nestjs/common';
import type { SupportTokenPayload } from '../../../common/auth/auth.types';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { PlatformAdminStatus } from '../../../generated/control/enums';
import { PlatformEnforcerService } from '../../rbac/platform-enforcer.service';

/**
 * Per-request check of a support token. Reads the control DB every time, without a cache: support sessions are rare, and
 * revoking or expiring one, or the admin losing the right, must end access on the very next request (E-PLAT-05).
 */
@Injectable()
export class SupportAccessService {
  constructor(
    private readonly control: ControlPrismaService,
    private readonly enforcer: PlatformEnforcerService,
  ) {}

  async isValid(payload: Pick<SupportTokenPayload, 'sub' | 'tid' | 'ssn'>): Promise<boolean> {
    const [session, admin] = await Promise.all([
      this.control.supportSession.findUnique({ where: { id: payload.ssn }, select: { tenantId: true, revokedAt: true, expiresAt: true } }),
      this.control.platformAdmin.findUnique({ where: { id: payload.sub }, select: { status: true } }),
    ]);
    return (
      !!session &&
      session.tenantId === payload.tid &&
      !session.revokedAt &&
      session.expiresAt > new Date() &&
      admin?.status === PlatformAdminStatus.ACTIVE &&
      (await this.enforcer.can(payload.sub, 'tenant', 'support'))
    );
  }
}
