import type { Prisma } from '../../generated/tenant/client';
import { validationError } from '../../common/errors/app.exception';
import { Grant, PERMISSIONS, SYSTEM_ROLES } from './permission-catalog';

/** Replaces all grants of a role. Run inside a transaction. */
export async function replaceRoleGrants(tx: Prisma.TransactionClient, roleId: string, grants: Grant[]) {
  const permissions = grants.length
    ? await tx.permission.findMany({ where: { OR: grants.map(({ resource, action }) => ({ resource, action })) } })
    : [];
  const idByKey = new Map(permissions.map((p) => [`${p.resource}.${p.action}`, p.id]));

  const unknown = grants.map((g, i) => ({ g, i })).filter(({ g }) => !idByKey.has(`${g.resource}.${g.action}`));
  if (unknown.length > 0) {
    throw validationError(
      unknown.map(({ g, i }) => ({
        field: `grants.${i}`,
        code: 'unknownPermission',
        message: `Unknown permission ${g.resource}.${g.action}`,
      })),
    );
  }

  await tx.rolePermission.deleteMany({ where: { roleId } });
  if (grants.length === 0) return;
  await tx.rolePermission.createMany({
    data: grants.map((g) => ({ roleId, permissionId: idByKey.get(`${g.resource}.${g.action}`)!, scope: g.scope })),
    skipDuplicates: true,
  });
}

/**
 * Brings a tenant DB in line with the code catalog: adds new permissions, removes retired ones
 * (and their grants), and resets system roles to their definition. Run on provisioning and after migrations.
 */
export async function syncRbacCatalog(tx: Prisma.TransactionClient) {
  const grantsBefore = await grantFingerprint(tx);
  await tx.permission.createMany({ data: PERMISSIONS, skipDuplicates: true });
  await tx.permission.deleteMany({
    where: { NOT: { OR: PERMISSIONS.map(({ resource, action }) => ({ resource, action })) } },
  });
  for (const def of SYSTEM_ROLES) {
    const role = await tx.role.upsert({
      where: { key: def.key },
      create: { key: def.key, name: def.name, description: def.description, isSystem: true },
      update: { name: def.name, description: def.description, isSystem: true },
    });
    await replaceRoleGrants(tx, role.id, def.grants);
  }
  // Roles of a deployed catalog changed: the UI of every user must reload its permissions
  if (grantsBefore !== (await grantFingerprint(tx))) await tx.user.updateMany({ data: { permissionsVersion: { increment: 1 } } });
}

async function grantFingerprint(tx: Prisma.TransactionClient) {
  const rows = await tx.rolePermission.findMany({
    select: { scope: true, role: { select: { key: true } }, permission: { select: { resource: true, action: true } } },
  });
  return rows
    .map((r) => `${r.role.key}:${r.permission.resource}.${r.permission.action}:${r.scope}`)
    .sort()
    .join('|');
}
