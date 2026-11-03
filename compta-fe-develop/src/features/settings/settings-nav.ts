import type { SettingsNavItemId } from "./types";

export type SettingsNavItem = {
  id: SettingsNavItemId;
  labelKey: string;
  href: string | null;
  /** Implemented page vs future placeholder. */
  available: boolean;
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: "general", labelKey: "nav.general", href: "/parametres", available: true },
  { id: "companies", labelKey: "nav.companies", href: "/parametres/societes", available: true },
  { id: "users", labelKey: "nav.users", href: "/parametres/utilisateurs", available: true },
  { id: "roles", labelKey: "nav.roles", href: "/parametres/roles", available: true },
];

export function matchSettingsNavId(pathname: string): SettingsNavItemId {
  if (pathname.startsWith("/parametres/societes")) return "companies";
  if (pathname.startsWith("/parametres/utilisateurs")) return "users";
  if (pathname.startsWith("/parametres/roles")) return "roles";
  if (pathname === "/parametres" || pathname.startsWith("/parametres/")) return "general";
  return "general";
}
