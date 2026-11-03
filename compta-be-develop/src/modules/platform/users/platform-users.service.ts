import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AppException, validationError } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { Prisma } from '../../../generated/control/client';
import { PlatformAdminStatus } from '../../../generated/control/enums';
import { hashPassword } from '../../auth/password';
import { PLATFORM_SUPER_ADMIN } from '../../rbac/platform-catalog';
import { PlatformEnforcerService } from '../../rbac/platform-enforcer.service';
import type { PlatformActor } from '../audit/platform-actor';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformStateService } from '../auth/platform-state.service';
import { CreatePlatformUserDto, ListPlatformUsersQuery, UpdatePlatformUserDto } from './dto/platform-user.dto';

// Serializes every change that can remove a Super Admin, so two of them cannot disable each other at once
const SUPER_ADMIN_LOCK = 'SELECT pg_advisory_xact_lock(7100101)';

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  fullName: true,
  status: true,
  permissionsVersion: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, key: true, name: true } },
} satisfies Prisma.PlatformAdminSelect;

const emailTaken = () =>
  validationError([{ field: 'email', code: ErrorCode.EMAIL_TAKEN, message: 'Email already used' }], 'Email already used');

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly control: ControlPrismaService,
    private readonly audit: PlatformAuditService,
    private readonly state: PlatformStateService,
    private readonly enforcer: PlatformEnforcerService,
  ) {}

  async list(query: ListPlatformUsersQuery) {
    const where: Prisma.PlatformAdminWhereInput = {
      status: query.status,
      ...(query.keyword && {
        OR: [{ email: { contains: query.keyword, mode: 'insensitive' } }, { fullName: { contains: query.keyword, mode: 'insensitive' } }],
      }),
    };
    const [items, total] = await Promise.all([
      this.control.platformAdmin.findMany({
        where,
        select: PUBLIC_FIELDS,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.control.platformAdmin.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string) {
    const admin = await this.control.platformAdmin.findUnique({ where: { id }, select: PUBLIC_FIELDS });
    if (!admin) throw new NotFoundException('User not found');
    return admin;
  }

  /** E-PLAT-03: emails are stored trimmed and lowercase, so "A@x" and "a@x" are the same account. */
  async create(dto: CreatePlatformUserDto, actor: PlatformActor) {
    const email = dto.email.trim().toLowerCase();
    await this.assertRoleExists(dto.roleId);
    const passwordHash = await hashPassword(dto.password);
    try {
      const created = await this.control.$transaction(async (tx) => {
        const admin = await tx.platformAdmin.create({
          data: { email, fullName: dto.fullName, passwordHash, roleId: dto.roleId },
          select: PUBLIC_FIELDS,
        });
        await this.audit.record(
          actor,
          { action: 'platform_user.create', targetType: 'platform_admin', targetId: admin.id, after: admin },
          tx,
        );
        return admin;
      });
      await this.enforcer.policyChanged();
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  }

  async update(id: string, dto: UpdatePlatformUserDto, actor: PlatformActor) {
    if (dto.roleId) await this.assertRoleExists(dto.roleId);
    const updated = await this.control.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(SUPER_ADMIN_LOCK);
      const before = await tx.platformAdmin.findUnique({ where: { id }, select: PUBLIC_FIELDS });
      if (!before) throw new NotFoundException('User not found');
      const roleChanges = !!dto.roleId && dto.roleId !== before.role.id;
      if (roleChanges) await this.assertAnotherSuperAdmin(tx, before);
      const after = await tx.platformAdmin.update({
        where: { id },
        data: { fullName: dto.fullName, roleId: dto.roleId, ...(roleChanges && { permissionsVersion: { increment: 1 } }) },
        select: PUBLIC_FIELDS,
      });
      await this.audit.record(actor, { action: 'platform_user.update', targetType: 'platform_admin', targetId: id, before, after }, tx);
      return after;
    });
    // E-PLAT-02: the next request of this admin uses the new role, on every instance
    await this.state.changed(id);
    return updated;
  }

  async setStatus(id: string, status: PlatformAdminStatus, actor: PlatformActor) {
    const updated = await this.control.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(SUPER_ADMIN_LOCK);
      const before = await tx.platformAdmin.findUnique({ where: { id }, select: PUBLIC_FIELDS });
      if (!before) throw new NotFoundException('User not found');
      if (before.status === status) return before;
      const disabling = status === PlatformAdminStatus.DISABLED;
      if (disabling) {
        await this.assertAnotherSuperAdmin(tx, before);
        await tx.platformSession.updateMany({ where: { adminId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      const after = await tx.platformAdmin.update({
        where: { id },
        data: { status, ...(disabling ? { tokenVersion: { increment: 1 } } : { failedLoginCount: 0, lockedUntil: null }) },
        select: PUBLIC_FIELDS,
      });
      await this.audit.record(actor, { action: 'platform_user.status', targetType: 'platform_admin', targetId: id, before, after }, tx);
      return after;
    });
    await this.state.changed(id);
    return updated;
  }

  async listRoles() {
    const roles = await this.control.platformRole.findMany({
      orderBy: { createdAt: 'asc' },
      include: { permissions: { include: { permission: true } }, _count: { select: { admins: true } } },
    });
    return roles.map(({ permissions, _count, ...role }) => ({
      ...role,
      memberCount: _count.admins,
      permissions: permissions.map((p) => ({ resource: p.permission.resource, action: p.permission.action })),
    }));
  }

  /** Caller holds SUPER_ADMIN_LOCK. Only matters when this admin is an ACTIVE Super Admin about to stop being one. */
  private async assertAnotherSuperAdmin(
    tx: Prisma.TransactionClient,
    admin: { id: string; status: PlatformAdminStatus; role: { key: string } },
  ) {
    if (admin.role.key !== PLATFORM_SUPER_ADMIN || admin.status !== PlatformAdminStatus.ACTIVE) return;
    const others = await tx.platformAdmin.count({
      where: { id: { not: admin.id }, status: PlatformAdminStatus.ACTIVE, role: { key: PLATFORM_SUPER_ADMIN } },
    });
    if (others === 0)
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.LAST_SUPER_ADMIN, 'The platform must keep one active Super Admin');
  }

  private async assertRoleExists(roleId: string) {
    if (!(await this.control.platformRole.findUnique({ where: { id: roleId }, select: { id: true } }))) {
      throw validationError([{ field: 'role_id', code: 'unknownRole', message: 'Unknown role' }]);
    }
  }
}
