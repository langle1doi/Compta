import type { Adapter, Model } from 'casbin';
import type { TenantPrismaClient } from '../../../database/tenant-prisma.manager';
import { UserStatus } from '../../../generated/tenant/enums';
import { companyDomain, roleSubject, userSubject } from './subjects';

/**
 * Read-only Casbin adapter that builds policies from the tenant's own tables:
 *   role_permissions -> p lines, memberships -> g lines (ACTIVE users only).
 * Those tables stay the single source of truth; change them through RolesService/UsersService,
 * then publish a policy change (EnforcerService.policyChanged).
 */
export class PrismaPolicyAdapter implements Adapter {
  constructor(private readonly db: TenantPrismaClient) {}

  async loadPolicy(model: Model): Promise<void> {
    const [grants, memberships] = await Promise.all([
      this.db.rolePermission.findMany({ include: { permission: true } }),
      this.db.membership.findMany({ where: { user: { status: UserStatus.ACTIVE } } }),
    ]);

    for (const grant of grants) {
      model.addPolicy('p', 'p', [roleSubject(grant.roleId), grant.permission.resource, grant.permission.action, grant.scope]);
    }
    for (const m of memberships) {
      model.addPolicy('g', 'g', [userSubject(m.userId), roleSubject(m.roleId), companyDomain(m.companyId)]);
    }
  }

  async savePolicy(): Promise<boolean> {
    return readOnly();
  }

  async addPolicy(): Promise<void> {
    readOnly();
  }

  async removePolicy(): Promise<void> {
    readOnly();
  }

  async removeFilteredPolicy(): Promise<void> {
    readOnly();
  }
}

function readOnly(): never {
  throw new Error('PrismaPolicyAdapter is read-only: edit roles/role_permissions/memberships instead');
}
