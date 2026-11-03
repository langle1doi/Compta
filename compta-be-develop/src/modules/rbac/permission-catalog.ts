import { DataScope } from '../../generated/tenant/enums';

export interface PermissionDef {
  resource: string;
  action: string;
  description: string;
}

export interface Grant {
  resource: string;
  action: string;
  scope: DataScope;
}

export interface SystemRoleDef {
  key: string;
  name: string;
  description: string;
  grants: Grant[];
}

const p = (resource: string, action: string, description: string): PermissionDef => ({ resource, action, description });
const g = (resource: string, action: string, scope: DataScope): Grant => ({ resource, action, scope });
const { OWN, COMPANY, TENANT } = DataScope;

/**
 * Permission catalog, named after PRD §1.8 (code = resource.action; the .all/.own suffix of the PRD is the scope).
 * Seeded into each tenant DB.
 */
export const PERMISSIONS: PermissionDef[] = [
  p('company', 'read', 'See companies (company selector)'),
  p('company', 'manage', 'Create/update companies and tax rates'),
  p('settings', 'manage', 'Tenant settings, numbering, templates'),
  p('user', 'manage', 'Invite/disable users, assign roles'),
  p('role', 'manage', 'Create/update custom roles'),
  p('bank', 'connect', 'Connect bank accounts (sensitive)'),
  p('dashboard', 'view', 'View dashboard KPIs'),
  p('customer', 'read', 'View customers'),
  p('customer', 'write', 'Create/update/share customers'),
  p('customer', 'delete', 'Delete customers without documents (sensitive)'),
  p('product', 'read', 'View catalog'),
  p('product', 'manage', 'Manage catalog'),
  p('quote', 'read', 'View quotes'),
  p('quote', 'write', 'Create/update/send quotes'),
  p('quote', 'approve', 'Approve quotes above the threshold'),
  p('invoice', 'read', 'View invoices'),
  p('invoice', 'request', 'Ask accounting to invoice a quote'),
  p('invoice', 'create', 'Create/update draft invoices'),
  p('invoice', 'validate', 'Validate (lock) invoices (sensitive)'),
  p('credit_note', 'create', 'Create and validate credit notes'),
  p('payment', 'record', 'Record payments'),
  p('payment', 'reconcile', 'Bank reconciliation'),
  p('report', 'view', 'View reports'),
  p('export', 'fec', 'Export accounting data (FEC)'),
  p('audit', 'view', 'Read audit log'),
  p('ai', 'use', 'Use the AI assistant (F15, counted against the plan)'),
];

/** Default roles created for every new tenant: PRD §1.8 matrix. System roles cannot be edited. */
export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    key: 'tenant_admin',
    name: 'Admin tenant',
    description: 'Companies, users, roles, settings, bank connection; all companies of the tenant',
    grants: [
      g('company', 'read', TENANT),
      g('company', 'manage', TENANT),
      g('settings', 'manage', TENANT),
      g('user', 'manage', TENANT),
      g('role', 'manage', TENANT),
      g('bank', 'connect', TENANT),
      g('dashboard', 'view', TENANT),
      g('customer', 'read', TENANT),
      g('customer', 'write', TENANT),
      g('customer', 'delete', TENANT),
      g('product', 'read', TENANT),
      g('product', 'manage', TENANT),
      g('quote', 'read', TENANT),
      g('quote', 'write', TENANT),
      g('invoice', 'read', TENANT),
      g('report', 'view', TENANT),
      g('export', 'fec', TENANT),
      g('audit', 'view', TENANT),
    ],
  },
  {
    key: 'owner',
    name: 'Chủ doanh nghiệp',
    description: 'Sees everything in the company, approves quotes, validates invoices',
    grants: [
      g('company', 'read', COMPANY),
      g('bank', 'connect', COMPANY),
      g('dashboard', 'view', COMPANY),
      g('customer', 'read', COMPANY),
      g('customer', 'write', COMPANY),
      g('customer', 'delete', COMPANY),
      g('product', 'read', COMPANY),
      g('product', 'manage', COMPANY),
      g('quote', 'read', COMPANY),
      g('quote', 'write', COMPANY),
      g('quote', 'approve', COMPANY),
      g('invoice', 'read', COMPANY),
      g('invoice', 'create', COMPANY),
      g('invoice', 'validate', COMPANY),
      g('credit_note', 'create', COMPANY),
      g('payment', 'record', COMPANY),
      g('payment', 'reconcile', COMPANY),
      g('report', 'view', COMPANY),
      g('export', 'fec', COMPANY),
      g('audit', 'view', COMPANY),
      g('ai', 'use', COMPANY),
    ],
  },
  {
    key: 'accountant',
    name: 'Kế toán',
    description: 'Invoices, credit notes, payments, accounting exports; reads customers and quotes',
    grants: [
      g('company', 'read', COMPANY),
      g('dashboard', 'view', COMPANY),
      g('customer', 'read', COMPANY),
      g('product', 'read', COMPANY),
      g('quote', 'read', COMPANY),
      g('invoice', 'read', COMPANY),
      g('invoice', 'create', COMPANY),
      g('invoice', 'validate', COMPANY),
      g('credit_note', 'create', COMPANY),
      g('payment', 'record', COMPANY),
      g('payment', 'reconcile', COMPANY),
      g('report', 'view', COMPANY),
      g('export', 'fec', COMPANY),
      g('ai', 'use', COMPANY),
    ],
  },
  {
    key: 'sales',
    name: 'Sale',
    description: 'Own customers and quotes only; can ask for an invoice',
    grants: [
      g('company', 'read', COMPANY),
      g('dashboard', 'view', OWN),
      g('customer', 'read', OWN),
      g('customer', 'write', OWN),
      g('product', 'read', COMPANY),
      g('quote', 'read', OWN),
      g('quote', 'write', OWN),
      g('invoice', 'read', OWN),
      g('invoice', 'request', OWN),
      g('ai', 'use', OWN),
    ],
  },
  {
    key: 'viewer',
    name: 'Người xem',
    description: 'Read-only: customers, quotes, catalog of the company',
    grants: [g('company', 'read', COMPANY), g('customer', 'read', COMPANY), g('product', 'read', COMPANY), g('quote', 'read', COMPANY)],
  },
];

export const TENANT_ADMIN_ROLE_KEY = 'tenant_admin';
