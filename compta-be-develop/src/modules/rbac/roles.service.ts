import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { EnforcerService } from './enforcer.service';
import { replaceRoleGrants } from './role-grants';

const GRANTS = { include: { permissions: { include: { permission: true } }, _count: { select: { memberships: true } } } } as const;

type RoleWithGrants = {
  permissions: { scope: string; permission: { resource: string; action: string } }[];
  _count: { memberships: number };
};

const view = <T extends RoleWithGrants>({ permissions, _count, ...role }: T) => ({
  ...role,
  memberCount: _count.memberships,
  grants: permissions.map((rp) => ({ resource: rp.permission.resource, action: rp.permission.action, scope: rp.scope })),
});

@Injectable()
export class RolesService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly enforcers: EnforcerService,
    private readonly audit: AuditService,
  ) {}

  listPermissions() {
    return this.tenantDb.client.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }

  async list() {
    const roles = await this.tenantDb.client.role.findMany({ orderBy: { createdAt: 'asc' }, ...GRANTS });
    return roles.map((role) => view(role));
  }

  async get(roleId: string) {
    const role = await this.tenantDb.client.role.findUnique({ where: { id: roleId }, ...GRANTS });
    if (!role) throw new NotFoundException('Role not found');
    return view(role);
  }

  async create(dto: CreateRoleDto, actor: AuditActor) {
    const role = await this.tenantDb.client.$transaction(async (tx) => {
      const created = await tx.role.create({ data: { key: dto.key, name: dto.name, description: dto.description } });
      await replaceRoleGrants(tx, created.id, dto.grants);
      await this.audit.record(
        actor,
        { action: 'role.create', entity: 'role', entityId: created.id, after: { ...created, grants: dto.grants } },
        tx,
      );
      return created;
    });
    await this.enforcers.policyChanged(this.tenantDb.tenantId);
    return role;
  }

  /** F04: system roles are not editable; custom roles are. F04 BR-05: before and after in the audit log. */
  async update(roleId: string, dto: UpdateRoleDto, actor: AuditActor) {
    const before = await this.get(roleId);
    if (before.isSystem) throw new AppException(HttpStatus.CONFLICT, ErrorCode.SYSTEM_ROLE_LOCKED, 'System roles cannot be modified');
    await this.tenantDb.client.$transaction(async (tx) => {
      await tx.role.update({ where: { id: roleId }, data: { name: dto.name, description: dto.description } });
      if (dto.grants) {
        await replaceRoleGrants(tx, roleId, dto.grants);
        await tx.user.updateMany({ where: { memberships: { some: { roleId } } }, data: { permissionsVersion: { increment: 1 } } });
      }
      await this.audit.record(actor, { action: 'role.update', entity: 'role', entityId: roleId, before, after: dto }, tx);
    });
    await this.enforcers.policyChanged(this.tenantDb.tenantId);
  }

  async remove(roleId: string, actor: AuditActor) {
    const role = await this.get(roleId);
    if (role.isSystem) throw new AppException(HttpStatus.CONFLICT, ErrorCode.SYSTEM_ROLE_LOCKED, 'System roles cannot be deleted');
    if (role.memberCount > 0) throw new AppException(HttpStatus.CONFLICT, ErrorCode.ROLE_IN_USE, 'Role is still assigned to users');
    await this.tenantDb.client.$transaction(async (tx) => {
      // The foreign key answers a membership created in the meantime (P2003 -> 409, E-RBAC-05)
      await tx.role.delete({ where: { id: roleId } });
      await this.audit.record(actor, { action: 'role.delete', entity: 'role', entityId: roleId, before: role }, tx);
    });
    await this.enforcers.policyChanged(this.tenantDb.tenantId);
  }
}
