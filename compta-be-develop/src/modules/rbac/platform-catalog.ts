export const PLATFORM_SUPER_ADMIN = 'PLATFORM_SUPER_ADMIN';
export const PLATFORM_OPERATOR = 'PLATFORM_OPERATOR';
export const PLATFORM_SUPPORT = 'PLATFORM_SUPPORT';

type Permission = [resource: string, action: string, description: string];

export const PLATFORM_PERMISSIONS: Permission[] = [
  ['tenant', 'read', 'List tenants and their details'],
  ['tenant', 'manage', 'Suspend and reactivate tenants, change their plan'],
  ['tenant', 'delete', 'Delete a suspended tenant'],
  ['tenant', 'provision', 'Create tenants, retry, resend the invitation'],
  ['tenant', 'export', 'Export the data of a suspended or deleted tenant'],
  ['tenant', 'support', 'Enter a tenant through a support session it granted'],
  ['plan', 'read', 'List plans'],
  ['plan', 'manage', 'Create, update, delete plans'],
  ['job', 'read', 'Follow background jobs'],
  ['migration', 'read', 'See schema versions'],
  ['migration', 'run', 'Run tenant migrations'],
  ['audit', 'read', 'Read the platform audit log'],
  ['user', 'read', 'List platform accounts'],
  ['user', 'manage', 'Create, update, disable platform accounts'],
  ['role', 'read', 'List platform roles'],
];

const code = (resource: string, action: string) => `${resource}.${action}`;
const ALL = PLATFORM_PERMISSIONS.map(([resource, action]) => code(resource, action));

/** System roles, not editable through the API. Only the Super Admin has a default account. */
export const PLATFORM_ROLES: { key: string; name: string; description: string; permissions: string[] }[] = [
  { key: PLATFORM_SUPER_ADMIN, name: 'Super Admin', description: 'Full access to the platform', permissions: ALL },
  {
    key: PLATFORM_OPERATOR,
    name: 'Operator',
    description: 'Tenants, provisioning, plans, migrations',
    permissions: [
      'tenant.read',
      'tenant.manage',
      'tenant.provision',
      'plan.read',
      'plan.manage',
      'job.read',
      'migration.read',
      'migration.run',
    ],
  },
  {
    key: PLATFORM_SUPPORT,
    name: 'Support',
    description: 'Read tenants, plans, jobs, migrations',
    permissions: ['tenant.read', 'plan.read', 'job.read', 'migration.read'],
  },
];
