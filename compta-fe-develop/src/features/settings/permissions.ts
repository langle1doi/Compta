import type {
  Capability,
  PermissionAction,
  PermissionGroup,
  PermissionId,
  PermissionModule,
  Role,
} from "./types";

export const SENSITIVE_PERMISSIONS = new Set<PermissionId>([
  "customer.delete",
  "invoice.validate",
  "bank.manage",
  "integration.manage",
  "role.manage",
  "user.disable",
  "user.invite",
  "user.update",
  "company.create",
  "company.update",
  "company.archive",
  "company.manage",
  "security.session.manage",
  "project.finance",
  "expense.approve",
]);

function action(
  id: string,
  labelKey: string,
  permission: PermissionId,
  searchTerms: string[],
  extras?: Pick<PermissionAction, "sensitive" | "noteKey">,
): PermissionAction {
  return {
    id,
    labelKey,
    permission,
    searchTerms,
    sensitive: extras?.sensitive ?? SENSITIVE_PERMISSIONS.has(permission),
    noteKey: extras?.noteKey,
  };
}

/** Accordion permission catalog — preferred UI surface. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "dashboard",
    labelKey: "groups.dashboard.label",
    descriptionKey: "groups.dashboard.description",
    actions: [
      action("dashboard.view", "actions.dashboard.view", "dashboard.view", ["dashboard", "kpi", "view"]),
    ],
  },
  {
    id: "company",
    labelKey: "groups.company.label",
    descriptionKey: "groups.company.description",
    actions: [
      action("company.view", "actions.company.view", "company.read", ["company", "view", "legal"]),
      action("company.create", "actions.company.create", "company.create", ["company", "create"], {
        sensitive: true,
      }),
      action("company.edit", "actions.company.edit", "company.update", ["company", "edit", "update"], {
        sensitive: true,
      }),
      action("company.archive", "actions.company.archive", "company.archive", ["archive", "company"], {
        sensitive: true,
      }),
      action("company.legal", "actions.company.legal", "company.manage", ["legal", "entities"], {
        sensitive: true,
      }),
    ],
  },
  {
    id: "users",
    labelKey: "groups.users.label",
    descriptionKey: "groups.users.description",
    actions: [
      action("user.view", "actions.users.view", "user.read", ["user", "view", "access"]),
      action("user.invite", "actions.users.invite", "user.invite", ["invite", "user"], { sensitive: true }),
      action("user.edit", "actions.users.edit", "user.update", ["edit", "user"], { sensitive: true }),
      action("user.disable", "actions.users.disable", "user.disable", ["disable", "user"], {
        sensitive: true,
      }),
      action("role.manage", "actions.users.roles", "role.manage", ["role", "permission"], {
        sensitive: true,
      }),
    ],
  },
  {
    id: "customers",
    labelKey: "groups.customers.label",
    descriptionKey: "groups.customers.description",
    actions: [
      action("customer.view", "actions.customers.view", "customer.read", ["customer", "view"]),
      action("customer.create", "actions.customers.create", "customer.create", ["customer", "create"]),
      action("customer.edit", "actions.customers.edit", "customer.update", ["customer", "edit"]),
      action("customer.delete", "actions.customers.delete", "customer.delete", ["customer", "delete"], {
        sensitive: true,
      }),
    ],
  },
  {
    id: "products",
    labelKey: "groups.products.label",
    descriptionKey: "groups.products.description",
    actions: [
      action("product.view", "actions.products.view", "product.read", ["product", "view"]),
      action("product.create", "actions.products.create", "product.create", ["product", "create"]),
      action("product.edit", "actions.products.edit", "product.update", ["product", "edit"]),
    ],
  },
  {
    id: "quotes",
    labelKey: "groups.quotes.label",
    descriptionKey: "groups.quotes.description",
    actions: [
      action("quote.view", "actions.quotes.view", "quote.read", ["quote", "view", "devis"]),
      action("quote.create", "actions.quotes.create", "quote.create", ["quote", "create"]),
      action("quote.edit", "actions.quotes.edit", "quote.update", ["quote", "edit"]),
      action("quote.send", "actions.quotes.send", "quote.send", ["quote", "send"]),
      action("quote.approve", "actions.quotes.approve", "quote.approve", ["quote", "approve"]),
    ],
  },
  {
    id: "invoices",
    labelKey: "groups.invoices.label",
    descriptionKey: "groups.invoices.description",
    actions: [
      action("invoice.view", "actions.invoices.view", "invoice.read", ["invoice", "view", "facture"]),
      action("invoice.create", "actions.invoices.create", "invoice.create", ["invoice", "create"]),
      action("invoice.validate", "actions.invoices.validate", "invoice.validate", ["invoice", "validate"], {
        sensitive: true,
        noteKey: "actions.invoices.validateNote",
      }),
      action("invoice.request", "actions.invoices.request", "invoice.request", ["invoice", "request"]),
      action("credit_note.create", "actions.invoices.creditNote", "credit_note.create", [
        "credit",
        "note",
        "avoir",
      ]),
    ],
  },
  {
    id: "payments",
    labelKey: "groups.payments.label",
    descriptionKey: "groups.payments.description",
    actions: [
      action("payment.view", "actions.payments.view", "payment.read", ["payment", "view"]),
      action("payment.record", "actions.payments.record", "payment.create", ["payment", "record"]),
      action("payment.reconcile", "actions.payments.reconcile", "payment.manage", [
        "payment",
        "reconciliation",
      ]),
      action("bank.manage", "actions.payments.bank", "bank.manage", ["bank", "connection"], {
        sensitive: true,
      }),
    ],
  },
  {
    id: "reports",
    labelKey: "groups.reports.label",
    descriptionKey: "groups.reports.description",
    actions: [
      action("report.view", "actions.reports.view", "report.read", ["report", "kpi", "view"]),
      action("report.export", "actions.reports.export", "report.export", ["report", "export", "fec"]),
    ],
  },
  {
    id: "projects",
    labelKey: "groups.projects.label",
    descriptionKey: "groups.projects.description",
    actions: [
      action("project.view", "actions.projects.view", "project.read", ["project", "view"]),
      action("project.create", "actions.projects.create", "project.create", ["project", "create"]),
      action("project.edit", "actions.projects.edit", "project.update", ["project", "edit", "link"]),
      action("project.finance", "actions.projects.finance", "project.finance", [
        "project",
        "cost",
        "margin",
        "profit",
      ], { sensitive: true }),
      action("expense.view", "actions.projects.expenseView", "expense.read", ["expense", "view"]),
      action("expense.create", "actions.projects.expenseCreate", "expense.create", [
        "expense",
        "create",
        "receipt",
      ]),
      action("expense.approve", "actions.projects.expenseApprove", "expense.approve", [
        "expense",
        "approve",
      ], { sensitive: true }),
    ],
  },
  {
    id: "templates",
    labelKey: "groups.templates.label",
    descriptionKey: "groups.templates.description",
    actions: [
      action("template.email", "actions.templates.email", "template.email.manage", ["email", "template"]),
      action("template.pdf", "actions.templates.pdf", "template.pdf.manage", ["pdf", "template"]),
    ],
  },
  {
    id: "security",
    labelKey: "groups.security.label",
    descriptionKey: "groups.security.description",
    actions: [
      action("security.sessions", "actions.security.sessions", "security.session.manage", [
        "session",
        "security",
      ], { sensitive: true }),
      action("audit.read", "actions.security.audit", "audit.read", ["audit", "log"]),
    ],
  },
  {
    id: "bank",
    labelKey: "groups.bank.label",
    descriptionKey: "groups.bank.description",
    phase: 2,
    actions: [
      action("bank.read", "actions.bank.view", "bank.read", ["bank", "view"]),
      action("bank.manage", "actions.bank.manage", "bank.manage", ["bank", "manage"], { sensitive: true }),
    ],
  },
  {
    id: "assistant",
    labelKey: "groups.assistant.label",
    descriptionKey: "groups.assistant.description",
    actions: [action("ai.use", "actions.assistant.use", "ai.use", ["assistant", "ai"])],
  },
  {
    id: "integrations",
    labelKey: "groups.integrations.label",
    descriptionKey: "groups.integrations.description",
    actions: [
      action("integration.read", "actions.integrations.view", "integration.read", [
        "integration",
        "view",
        "connector",
      ]),
      action(
        "integration.manage",
        "actions.integrations.manage",
        "integration.manage",
        ["integration", "manage", "connect", "webhook", "api"],
        { sensitive: true },
      ),
    ],
  },
];

/** Legacy capability grid — kept for create-role dialog chips. */
export const PERMISSION_MODULES: PermissionModule[] = PERMISSION_GROUPS.filter(
  (group) => group.phase !== 2,
).map((group) => ({
  id: group.id,
  labelKey: group.labelKey,
  phase: group.phase,
  capabilities: uniqueCapabilities(group.actions),
}));

function uniqueCapabilities(actions: PermissionAction[]): PermissionModule["capabilities"] {
  const map = new Map<PermissionId, PermissionModule["capabilities"][number]>();
  for (const entry of actions) {
    if (map.has(entry.permission)) continue;
    const capability = inferCapability(entry.permission);
    map.set(entry.permission, {
      capability,
      permission: entry.permission,
      sensitive: entry.sensitive,
    });
  }
  return [...map.values()];
}

const CRUD_CAPABILITIES: Capability[] = ["create", "read", "update", "delete"];

export function permissionCapability(permission: PermissionId): Capability {
  const verb = permission.split(".")[1] ?? "read";
  if (verb === "read" || verb === "view") return "read";
  if (verb === "create") return "create";
  if (verb === "update") return "update";
  if (verb === "delete") return "delete";
  if (verb === "send") return "send";
  if (verb === "approve") return "approve";
  if (verb === "validate") return "validate";
  if (verb === "invite") return "invite";
  if (verb === "disable") return "disable";
  if (verb === "export") return "export";
  return "manage";
}

/** @deprecated Use permissionCapability */
function inferCapability(permission: PermissionId): Capability {
  return permissionCapability(permission);
}

export function isCrudCapability(capability: Capability): boolean {
  return CRUD_CAPABILITIES.includes(capability);
}

export function groupCrudActions(actions: PermissionAction[]) {
  const crud = new Map<Capability, PermissionAction>();
  const extra: PermissionAction[] = [];
  for (const entry of actions) {
    const capability = permissionCapability(entry.permission);
    if (isCrudCapability(capability)) {
      if (!crud.has(capability)) crud.set(capability, entry);
      continue;
    }
    extra.push(entry);
  }
  return {
    crudColumns: CRUD_CAPABILITIES.map((capability) => ({
      capability,
      action: crud.get(capability) ?? null,
    })),
    extra,
  };
}

export function roleHasPermission(role: Role, permission: PermissionId): boolean {
  return role.permissions.includes(permission);
}

export function permissionsInclude(
  permissions: readonly PermissionId[],
  permission: PermissionId,
): boolean {
  return permissions.includes(permission);
}

/** @deprecated Prefer PERMISSION_GROUPS accordion UI. Kept for legacy matrix helper. */
export function usedCapabilities(modules: PermissionModule[] = PERMISSION_MODULES): Capability[] {
  const order: Capability[] = [
    "read",
    "create",
    "update",
    "delete",
    "send",
    "approve",
    "validate",
    "manage",
    "invite",
    "disable",
    "export",
  ];
  const present = new Set<Capability>();
  for (const entry of modules) {
    for (const cap of entry.capabilities) present.add(cap.capability);
  }
  return order.filter((cap) => present.has(cap));
}

export function filterPermissionGroups(
  groups: PermissionGroup[],
  query: string,
): PermissionGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;
  return groups
    .map((group) => {
      const actions = group.actions.filter(
        (entry) =>
          entry.searchTerms.some((term) => term.includes(needle)) ||
          entry.permission.includes(needle) ||
          entry.id.includes(needle) ||
          entry.labelKey.toLowerCase().includes(needle),
      );
      const groupMatch =
        group.id.includes(needle) ||
        group.labelKey.toLowerCase().includes(needle) ||
        group.descriptionKey.toLowerCase().includes(needle);
      if (groupMatch) return group;
      if (actions.length === 0) return null;
      return { ...group, actions };
    })
    .filter((group): group is PermissionGroup => group !== null);
}
