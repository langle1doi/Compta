import { Injectable, Logger } from '@nestjs/common';
import { ControlPrismaService } from '../../database/control-prisma.service';
import { TenantStatus } from '../../generated/control/enums';
import { UserStatus } from '../../generated/tenant/enums';
import { verifyPassword } from '../auth/password';
import { TenantRegistryService } from '../tenancy/tenant-registry.service';
import { DEFAULT_PASSWORD, defaultTenantAccounts, SUPER_ADMIN_EMAIL } from './tenants/default-accounts';

/** Startup check: logs a warning while seeded accounts still use the default password. */
@Injectable()
export class DefaultCredentialsService {
  private readonly logger = new Logger(DefaultCredentialsService.name);

  constructor(
    private readonly control: ControlPrismaService,
    private readonly registry: TenantRegistryService,
  ) {}

  /** Runs in the background after the server starts; never throws. */
  async warnIfDefaultPasswordsInUse(): Promise<void> {
    const found: string[] = [];
    try {
      const admin = await this.control.platformAdmin.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });
      if (admin && (await verifyPassword(admin.passwordHash, DEFAULT_PASSWORD))) found.push(SUPER_ADMIN_EMAIL);

      const tenants = await this.control.tenant.findMany({ where: { status: { in: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED] } } });
      for (const tenant of tenants) {
        try {
          const users = await this.registry.clientFor(tenant).user.findMany({
            where: { email: { in: defaultTenantAccounts(tenant.subdomain).map((a) => a.email) }, status: UserStatus.ACTIVE },
            select: { email: true, passwordHash: true },
          });
          for (const user of users) {
            if (user.passwordHash && (await verifyPassword(user.passwordHash, DEFAULT_PASSWORD))) found.push(user.email);
          }
        } catch (error) {
          this.logger.warn({ err: error, tenant: tenant.subdomain }, 'Could not check default accounts of tenant');
        }
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Default credentials check failed');
      return;
    }

    if (found.length > 0) {
      this.logger.warn({ accounts: found }, `${found.length} account(s) still use the default password: change them`);
    }
  }
}
