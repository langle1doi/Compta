import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AppException, validationError } from '../../common/errors/app.exception';
import { ErrorCode, FieldError } from '../../common/errors/error-codes';
import type { Prisma } from '../../generated/tenant/client';
import { CompanyStatus, UserStatus } from '../../generated/tenant/enums';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { hashPassword } from '../auth/password';
import { UserStateService } from '../auth/user-state.service';
import { AccessContext, companyFilter } from '../rbac/access';
import { EnforcerService } from '../rbac/enforcer.service';
import { TENANT_ADMIN_ROLE_KEY } from '../rbac/permission-catalog';
import { PlanLimitsService } from '../tenancy/plan-limits.service';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { CreateUserDto } from './dto/create-user.dto';
import { MembershipDto } from './dto/membership.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  locale: true,
  status: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  memberships: { select: { companyId: true, role: { select: { id: true, key: true, name: true } } } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly enforcers: EnforcerService,
    private readonly userState: UserStateService,
    private readonly planLimits: PlanLimitsService,
    private readonly audit: AuditService,
  ) {}

  list(access: AccessContext) {
    const companyId = companyFilter(access);
    return this.tenantDb.client.user.findMany({
      where: companyId ? { memberships: { some: { OR: [{ companyId }, { companyId: null }] } } } : {},
      select: USER_SELECT,
      orderBy: { fullName: 'asc' },
    });
  }

  /** Deprecated in favour of invitations. A user without a role is DISABLED (no seat used, cannot log in). */
  async create(dto: CreateUserDto, actor: AuditActor) {
    await this.assertMembershipsValid(dto.memberships);
    const status = dto.memberships.length > 0 ? UserStatus.ACTIVE : UserStatus.DISABLED;
    if (status === UserStatus.ACTIVE) await this.planLimits.assertCanAdd('users');
    const passwordHash = await hashPassword(dto.password);
    const user = await this.tenantDb.client.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          locale: dto.locale,
          passwordHash,
          status,
          memberships: { create: dto.memberships.map((m) => ({ companyId: m.companyId ?? null, roleId: m.roleId })) },
        },
        select: USER_SELECT,
      });
      await this.audit.record(actor, { action: 'user.create', entity: 'user', entityId: created.id, after: created }, tx);
      return created;
    });
    await this.enforcers.policyChanged(this.tenantDb.tenantId);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.tenantDb.client.user.update({ where: { id }, data: dto, select: USER_SELECT });
  }

  /** F04 AC-04: disabling ends every session now and cancels the invitations this user still has pending (E-INV-04). */
  async setStatus(id: string, status: UserStatus, actor: AuditActor) {
    const db = this.tenantDb.client;
    const current = await db.user.findUnique({ where: { id }, select: { status: true, _count: { select: { memberships: true } } } });
    if (!current) throw new NotFoundException('User not found');
    if (current.status === status) return db.user.findUniqueOrThrow({ where: { id }, select: USER_SELECT });
    if (status === UserStatus.ACTIVE) {
      if (current._count.memberships === 0) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.USER_HAS_NO_ROLE, 'A user without a role cannot be active');
      }
      if (current.status === UserStatus.DISABLED) await this.planLimits.assertCanAdd('users');
    }

    const sessions =
      status === UserStatus.DISABLED ? await db.session.findMany({ where: { userId: id, revokedAt: null }, select: { id: true } }) : [];
    const user = await this.withAdminGuard(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status, ...(status === UserStatus.DISABLED && { tokenVersion: { increment: 1 } }) },
        select: USER_SELECT,
      });
      if (status === UserStatus.DISABLED) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.invitation.updateMany({ where: { invitedById: id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await this.audit.record(
        actor,
        { action: 'user.status', entity: 'user', entityId: id, before: { status: current.status }, after: { status } },
        tx,
      );
      return updated;
    });
    await this.afterUserChange(id, sessions);
    return user;
  }

  /**
   * First role: a user without roles becomes ACTIVE. Last role removed: DISABLED and logged out.
   * INVITED users stay INVITED while they have a role.
   */
  async setMemberships(userId: string, memberships: MembershipDto[], actor: AuditActor) {
    await this.assertMembershipsValid(memberships);
    const db = this.tenantDb.client;
    const before = await db.user.findUnique({
      where: { id: userId },
      select: { status: true, memberships: { select: { companyId: true, roleId: true } } },
    });
    if (!before) throw new NotFoundException('User not found');

    const hadNone = before.memberships.length === 0;
    const hasNone = memberships.length === 0;
    const activates = hadNone && !hasNone && before.status === UserStatus.DISABLED;
    if (activates) await this.planLimits.assertCanAdd('users');
    const disables = hasNone && before.status !== UserStatus.DISABLED;
    const sessions = disables ? await db.session.findMany({ where: { userId, revokedAt: null }, select: { id: true } }) : [];

    const user = await this.withAdminGuard(async (tx) => {
      await tx.membership.deleteMany({ where: { userId } });
      await tx.membership.createMany({ data: memberships.map((m) => ({ userId, companyId: m.companyId ?? null, roleId: m.roleId })) });
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          permissionsVersion: { increment: 1 },
          ...(activates && { status: UserStatus.ACTIVE }),
          ...(disables && { status: UserStatus.DISABLED, tokenVersion: { increment: 1 } }),
        },
        select: USER_SELECT,
      });
      if (disables) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record(
        actor,
        {
          action: 'user.memberships',
          entity: 'user',
          entityId: userId,
          before: before.memberships,
          after: memberships.map((m) => ({ companyId: m.companyId ?? null, roleId: m.roleId })),
        },
        tx,
      );
      return updated;
    });
    await this.afterUserChange(userId, sessions);
    return user;
  }

  private async afterUserChange(userId: string, sessions: { id: string }[]) {
    const { tenantId } = this.tenantDb;
    await this.userState.changed(tenantId, userId);
    for (const { id } of sessions) await this.userState.sessionRevoked(tenantId, id);
    await this.enforcers.policyChanged(tenantId);
  }

  /**
   * F04 BR-01: at least one ACTIVE user must keep the tenant_admin role tenant-wide.
   * Runs the change, then checks, in one transaction; the role row lock serializes concurrent admin changes.
   */
  private async withAdminGuard<T>(change: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.tenantDb.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM roles WHERE key = ${TENANT_ADMIN_ROLE_KEY} FOR UPDATE`;
      const result = await change(tx);
      const admins = await tx.membership.count({
        where: { companyId: null, role: { key: TENANT_ADMIN_ROLE_KEY }, user: { status: UserStatus.ACTIVE } },
      });
      if (admins === 0) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.LAST_ADMIN, 'The tenant must keep at least one active Admin tenant');
      }
      return result;
    });
  }

  /** One role per company, and every referenced company/role must exist (company ACTIVE). */
  async assertMembershipsValid(memberships: MembershipDto[]) {
    const errors: FieldError[] = [];
    const seen = new Set<string>();
    memberships.forEach((m, i) => {
      const key = m.companyId ?? '*';
      if (seen.has(key)) errors.push({ field: `memberships.${i}.companyId`, code: 'duplicate', message: 'One role per company' });
      seen.add(key);
    });

    const db = this.tenantDb.client;
    const companyIds = [...new Set(memberships.map((m) => m.companyId).filter((id): id is string => !!id))];
    const roleIds = [...new Set(memberships.map((m) => m.roleId))];
    const [companies, roles] = await Promise.all([
      db.company.findMany({ where: { id: { in: companyIds }, status: CompanyStatus.ACTIVE }, select: { id: true } }),
      db.role.findMany({ where: { id: { in: roleIds } }, select: { id: true } }),
    ]);
    const okCompanies = new Set(companies.map((c) => c.id));
    const okRoles = new Set(roles.map((r) => r.id));
    memberships.forEach((m, i) => {
      if (m.companyId && !okCompanies.has(m.companyId)) {
        errors.push({ field: `memberships.${i}.companyId`, code: 'notFound', message: 'Unknown or inactive company' });
      }
      if (!okRoles.has(m.roleId)) errors.push({ field: `memberships.${i}.roleId`, code: 'notFound', message: 'Unknown role' });
    });
    if (errors.length > 0) throw validationError(errors);
  }
}
