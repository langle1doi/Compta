import type { PermissionId } from "./types";

type RouteRule = {
  /** Path without locale. The longest matching prefix wins. */
  prefix: string;
  /** Any of these opens the page. An empty list means every signed-in user. */
  anyOf: PermissionId[];
};

/** Single table for "who can open which page": used by the route gate, sidebar and settings nav. */
export const ROUTE_RULES: RouteRule[] = [
  { prefix: "/customers", anyOf: ["customer.read"] },
  { prefix: "/devis", anyOf: ["quote.read"] },
  { prefix: "/factures", anyOf: ["invoice.read"] },
  { prefix: "/paiements", anyOf: ["payment.read"] },
  { prefix: "/produits", anyOf: ["product.read"] },
  { prefix: "/rapports", anyOf: ["report.read"] },
  { prefix: "/automation", anyOf: ["automation.read"] },
  { prefix: "/projects", anyOf: ["project.read"] },
  { prefix: "/templates", anyOf: ["template.email.read", "template.pdf.read"] },
  { prefix: "/integrations", anyOf: ["integration.read"] },
  { prefix: "/activite", anyOf: ["audit.read"] },
  { prefix: "/parametres/societes", anyOf: ["company.read"] },
  { prefix: "/parametres/utilisateurs", anyOf: ["user.read"] },
  { prefix: "/parametres/roles", anyOf: ["role.read"] },
  { prefix: "/parametres/audit", anyOf: ["audit.read"] },
  { prefix: "/parametres/securite", anyOf: ["security.session.manage"] },
  { prefix: "/parametres", anyOf: [] },
];

const HOME_PERMISSION: PermissionId = "dashboard.view";

function ruleFor(pathname: string) {
  return ROUTE_RULES.filter(
    (rule) =>
      pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
}

export function canOpenRoute(
  pathname: string,
  permissions: readonly PermissionId[],
) {
  if (pathname === "/") return permissions.includes(HOME_PERMISSION);
  const rule = ruleFor(pathname);
  if (!rule) return false;
  return (
    rule.anyOf.length === 0 || rule.anyOf.some((id) => permissions.includes(id))
  );
}

/** Where to land when the dashboard is not available; null when the user has no rights at all. */
export function firstOpenRoute(permissions: readonly PermissionId[]) {
  if (permissions.includes(HOME_PERMISSION)) return "/";
  const candidate = ROUTE_RULES.find(
    (rule) =>
      rule.anyOf.length > 0 &&
      rule.anyOf.some((id) => permissions.includes(id)),
  );
  return candidate?.prefix ?? null;
}
