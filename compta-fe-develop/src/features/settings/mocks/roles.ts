import type { PermissionId, Role } from "../types";

const tenantAdminPermissions: PermissionId[] = [
  "company.read",
  "company.create",
  "company.update",
  "company.archive",
  "company.manage",
  "user.read",
  "user.invite",
  "user.update",
  "user.disable",
  "role.read",
  "role.manage",
  "customer.read",
  "customer.create",
  "customer.update",
  "customer.delete",
  "product.read",
  "product.create",
  "product.update",
  "quote.read",
  "quote.create",
  "quote.update",
  "quote.send",
  "quote.approve",
  "invoice.read",
  "invoice.create",
  "invoice.validate",
  "payment.read",
  "payment.create",
  "payment.manage",
  "template.email.read",
  "template.email.manage",
  "template.pdf.read",
  "template.pdf.manage",
  "report.read",
  "report.export",
  "automation.read",
  "automation.manage",
  "automation.approve",
  "project.read",
  "project.create",
  "project.update",
  "project.finance",
  "expense.read",
  "expense.create",
  "expense.approve",
  "security.session.manage",
  "audit.read",
  // Bank is Phase 2 — catalog shows it, default tenant admin may manage when module is enabled.
  "bank.read",
  "bank.manage",
  "integration.read",
  "integration.manage",
];

const businessOwnerPermissions: PermissionId[] = [
  "company.read",
  "customer.read",
  "product.read",
  "quote.read",
  "quote.approve",
  "invoice.read",
  "invoice.validate",
  "payment.read",
  "report.read",
  "report.export",
  "automation.read",
  "automation.manage",
  "automation.approve",
  "project.read",
  "project.create",
  "project.update",
  "project.finance",
  "expense.read",
  "expense.create",
  "expense.approve",
  "audit.read",
  "integration.read",
  "integration.manage",
];

/** Accountant: invoices/payments ops. No quote create/update/send per PRD. */
const accountantPermissions: PermissionId[] = [
  "company.read",
  "customer.read",
  "product.read",
  "quote.read",
  "invoice.read",
  "invoice.create",
  "invoice.validate",
  "payment.read",
  "payment.create",
  "payment.manage",
  "report.read",
  "report.export",
  "automation.read",
  "automation.approve",
  "project.read",
  "project.create",
  "project.update",
  "project.finance",
  "expense.read",
  "expense.create",
  "expense.approve",
];

/** Sales: OWN scope defaults. No invoice.validate. No project cost/margin. */
const salesPermissions: PermissionId[] = [
  "customer.read",
  "customer.create",
  "customer.update",
  "product.read",
  "quote.read",
  "quote.create",
  "quote.update",
  "quote.send",
  "invoice.read",
  "report.read",
  "automation.read",
  "automation.approve",
  "project.read",
  "project.create",
  "project.update",
  "expense.read",
  "expense.create",
];

/** Viewer: read-only. */
const viewerPermissions: PermissionId[] = [
  "company.read",
  "customer.read",
  "product.read",
  "quote.read",
  "invoice.read",
  "payment.read",
  "report.read",
  "automation.read",
  "project.read",
  "expense.read",
  "integration.read",
];

export const systemRoles: Role[] = [
  {
    id: "tenant-admin",
    nameKey: "roles.tenantAdmin.name",
    descriptionKey: "roles.tenantAdmin.description",
    cardDescriptionKey: "roles.tenantAdmin.card",
    defaultScope: "TENANT",
    permissions: tenantAdminPermissions,
    system: true,
  },
  {
    id: "business-owner",
    nameKey: "roles.businessOwner.name",
    descriptionKey: "roles.businessOwner.description",
    cardDescriptionKey: "roles.businessOwner.card",
    defaultScope: "COMPANY",
    permissions: businessOwnerPermissions,
    system: true,
  },
  {
    id: "accountant",
    nameKey: "roles.accountant.name",
    descriptionKey: "roles.accountant.description",
    cardDescriptionKey: "roles.accountant.card",
    defaultScope: "COMPANY",
    permissions: accountantPermissions,
    system: true,
  },
  {
    id: "sales",
    nameKey: "roles.sales.name",
    descriptionKey: "roles.sales.description",
    cardDescriptionKey: "roles.sales.card",
    defaultScope: "OWN",
    permissions: salesPermissions,
    system: true,
  },
  {
    id: "viewer",
    nameKey: "roles.viewer.name",
    descriptionKey: "roles.viewer.description",
    cardDescriptionKey: "roles.viewer.card",
    defaultScope: "COMPANY",
    permissions: viewerPermissions,
    system: true,
  },
];

/** Platform Super Admin — excluded from tenant role lists. */
export const platformSuperAdminRole: Role = {
  id: "super-admin",
  nameKey: "roles.superAdmin.name",
  descriptionKey: "roles.superAdmin.description",
  cardDescriptionKey: "roles.superAdmin.card",
  defaultScope: "TENANT",
  permissions: [],
  system: true,
  platform: true,
};

export function getTenantRoles(roles: Role[] = systemRoles): Role[] {
  return roles.filter((role) => !role.platform);
}

export function getRoleById(roleId: string, roles: Role[] = systemRoles): Role | undefined {
  return roles.find((role) => role.id === roleId);
}

/** Mock-only default scope suggestion when assigning a role in the edit form. */
export function suggestedScopeForRole(roleId: string): Role["defaultScope"] {
  const role = getRoleById(roleId);
  return role?.defaultScope ?? "COMPANY";
}
