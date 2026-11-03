import {
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Link2,
  Mail,
  Package,
  ReceiptText,
  Settings,
  Sparkles,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "nav.overview"
  | "nav.customers"
  | "nav.quotes"
  | "nav.invoices"
  | "nav.payments"
  | "nav.products"
  | "nav.reports"
  | "nav.automation"
  | "nav.projects"
  | "nav.templates"
  | "nav.integrations"
  | "nav.settings";

export type SidebarNavLink = {
  labelKey: NavKey;
  icon: LucideIcon;
  href?: string;
  /** Prefix used for active matching when the link target is a nested default page. */
  matchPrefix?: string;
  count?: string;
};

export const mainNav: SidebarNavLink[] = [
  { labelKey: "nav.overview", icon: LayoutDashboard, href: "/" },
  { labelKey: "nav.customers", icon: UsersRound, href: "/customers" },
  { labelKey: "nav.quotes", icon: FileText, href: "/devis", count: "6" },
  { labelKey: "nav.invoices", icon: ReceiptText, href: "/factures" },
  { labelKey: "nav.payments", icon: WalletCards, href: "/paiements", count: "3" },
  { labelKey: "nav.products", icon: Package, href: "/produits" },
  { labelKey: "nav.reports", icon: Gauge, href: "/rapports" },
];

export const opsNav: SidebarNavLink[] = [
  { labelKey: "nav.automation", icon: Sparkles, href: "/automation" },
  { labelKey: "nav.projects", icon: FolderKanban, href: "/projects" },
  { labelKey: "nav.templates", icon: Mail, href: "/templates" },
  { labelKey: "nav.integrations", icon: Link2, href: "/integrations" },
  {
    labelKey: "nav.settings",
    icon: Settings,
    href: "/parametres",
    matchPrefix: "/parametres",
  },
];

export function pathMatches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function matchRouteKey(pathname: string): NavKey {
  const normalized = pathname || "/";
  const ranked = [...mainNav, ...opsNav]
    .filter((item) => item.href)
    .sort(
      (a, b) =>
        (b.matchPrefix?.length ?? b.href?.length ?? 0) -
        (a.matchPrefix?.length ?? a.href?.length ?? 0),
    );

  for (const item of ranked) {
    const matchRoot = item.matchPrefix ?? item.href ?? "/";
    if (pathMatches(normalized, matchRoot)) return item.labelKey;
  }

  return "nav.overview";
}

export function isExactHref(pathname: string, item: SidebarNavLink): boolean {
  if (!item.href) return false;
  return pathMatches(pathname, item.href);
}
