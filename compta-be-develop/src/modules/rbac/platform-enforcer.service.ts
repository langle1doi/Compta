import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Adapter, Enforcer, Model, newEnforcer, newModelFromString } from 'casbin';
import { ControlEventsService } from '../../database/control-events.service';
import { ControlPrismaService } from '../../database/control-prisma.service';
import { PlatformAdminStatus } from '../../generated/control/enums';
import type { Prisma } from '../../generated/control/client';
import { PLATFORM_PERMISSIONS, PLATFORM_ROLES } from './platform-catalog';

const MODEL_TEXT = readFileSync(join(__dirname, 'casbin', 'platform-model.conf'), 'utf8');
const DOMAIN = 'platform';
const MAX_POLICY_AGE_MS = 5 * 60 * 1000;

class PlatformPolicyAdapter implements Adapter {
  constructor(private readonly control: ControlPrismaService) {}

  async loadPolicy(model: Model) {
    const [grants, admins] = await Promise.all([
      this.control.platformRolePermission.findMany({ include: { permission: true } }),
      this.control.platformAdmin.findMany({ where: { status: PlatformAdminStatus.ACTIVE }, select: { id: true, roleId: true } }),
    ]);
    for (const g of grants) model.addPolicy('p', 'p', [`role:${g.roleId}`, DOMAIN, g.permission.resource, g.permission.action]);
    for (const a of admins) model.addPolicy('g', 'g', [`admin:${a.id}`, `role:${a.roleId}`, DOMAIN]);
  }
  savePolicy(): Promise<boolean> {
    return Promise.resolve(false);
  }
  addPolicy(): Promise<void> {
    return Promise.resolve();
  }
  removePolicy(): Promise<void> {
    return Promise.resolve();
  }
  removeFilteredPolicy(): Promise<void> {
    return Promise.resolve();
  }
}

/** Platform authorization, read from the control tables; a change applies at once through NOTIFY. */
@Injectable()
export class PlatformEnforcerService {
  private cached?: { enforcer: Promise<Enforcer>; loadedAt: number };

  constructor(
    private readonly control: ControlPrismaService,
    private readonly events: ControlEventsService,
  ) {
    events.subscribe((event) => {
      if (event.kind === 'platform_policy' || event.kind === 'platform_admin') this.cached = undefined;
    });
  }

  async can(adminId: string, resource: string, action: string): Promise<boolean> {
    if (!this.cached || Date.now() - this.cached.loadedAt >= MAX_POLICY_AGE_MS) {
      const enforcer = newEnforcer(newModelFromString(MODEL_TEXT), new PlatformPolicyAdapter(this.control));
      this.cached = { enforcer, loadedAt: Date.now() };
      enforcer.catch(() => (this.cached = undefined));
    }
    return (await this.cached.enforcer).enforce(`admin:${adminId}`, DOMAIN, resource, action);
  }

  async policyChanged() {
    await this.events.publish({ kind: 'platform_policy' });
  }
}

/** Keeps the control tables equal to the code catalog. Run by seed-control. */
export async function syncPlatformCatalog(tx: Prisma.TransactionClient) {
  await tx.platformPermission.createMany({
    data: PLATFORM_PERMISSIONS.map(([resource, action, description]) => ({ resource, action, description })),
    skipDuplicates: true,
  });
  await tx.platformPermission.deleteMany({
    where: { NOT: { OR: PLATFORM_PERMISSIONS.map(([resource, action]) => ({ resource, action })) } },
  });
  const permissions = await tx.platformPermission.findMany();
  for (const def of PLATFORM_ROLES) {
    const role = await tx.platformRole.upsert({
      where: { key: def.key },
      create: { key: def.key, name: def.name, description: def.description },
      update: { name: def.name, description: def.description },
    });
    await tx.platformRolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.platformRolePermission.createMany({
      data: permissions
        .filter((p) => def.permissions.includes(`${p.resource}.${p.action}`))
        .map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }
}
