import { DataScope } from '../../src/generated/tenant/enums';

const { OWN, COMPANY, TENANT } = DataScope;
export type Matrix = Record<string, DataScope>;

/**
 * PRD §1.8 matrix, locked. Changing a system role must update this table on purpose.
 * Marked "(+)" = not in the §1.8 table, added because the role cannot work without it (approved by the PO).
 */
export const PRD_PERMISSION_MATRIX: Record<string, Matrix> = {
  tenant_admin: {
    'company.read': TENANT, // (+) company selector
    'company.manage': TENANT,
    'settings.manage': TENANT,
    'user.manage': TENANT,
    'role.manage': TENANT,
    'bank.connect': TENANT,
    'dashboard.view': TENANT,
    'customer.read': TENANT,
    'customer.write': TENANT,
    'customer.delete': TENANT, // (+) PRD §3 "xóa khách" is a sensitive permission
    'product.read': TENANT, // (+) F07 users: Admin, Chủ DN
    'product.manage': TENANT, // (+) F07
    'quote.read': TENANT,
    'quote.write': TENANT,
    'invoice.read': TENANT, // (+) read-only; no create/validate/credit note/payment
    'report.view': TENANT,
    'export.fec': TENANT,
    'audit.view': TENANT,
  },
  owner: {
    'company.read': COMPANY,
    'bank.connect': COMPANY,
    'dashboard.view': COMPANY,
    'customer.read': COMPANY,
    'customer.write': COMPANY,
    'customer.delete': COMPANY,
    'product.read': COMPANY,
    'product.manage': COMPANY,
    'quote.read': COMPANY,
    'quote.write': COMPANY,
    'quote.approve': COMPANY,
    'invoice.read': COMPANY,
    'invoice.create': COMPANY,
    'invoice.validate': COMPANY,
    'credit_note.create': COMPANY,
    'payment.record': COMPANY,
    'payment.reconcile': COMPANY,
    'report.view': COMPANY,
    'export.fec': COMPANY,
    'audit.view': COMPANY,
    'ai.use': COMPANY,
  },
  accountant: {
    'company.read': COMPANY,
    'dashboard.view': COMPANY,
    'customer.read': COMPANY,
    'product.read': COMPANY,
    'quote.read': COMPANY,
    'invoice.read': COMPANY,
    'invoice.create': COMPANY,
    'invoice.validate': COMPANY,
    'credit_note.create': COMPANY,
    'payment.record': COMPANY,
    'payment.reconcile': COMPANY,
    'report.view': COMPANY,
    'export.fec': COMPANY,
    'ai.use': COMPANY,
  },
  sales: {
    'company.read': COMPANY,
    'dashboard.view': OWN,
    'customer.read': OWN,
    'customer.write': OWN,
    'product.read': COMPANY,
    'quote.read': OWN,
    'quote.write': OWN,
    'invoice.read': OWN,
    'invoice.request': OWN,
    'ai.use': OWN,
  },
  viewer: {
    'company.read': COMPANY,
    'customer.read': COMPANY,
    'product.read': COMPANY, // (+) to read quote lines
    'quote.read': COMPANY,
  },
};
