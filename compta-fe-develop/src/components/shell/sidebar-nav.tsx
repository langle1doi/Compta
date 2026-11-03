/**
 * @deprecated Prefer `SidebarChrome` / `SidebarLink` from `@/components/shell/sidebar`.
 * Nav data remains the single source of truth in `sidebar/sidebar-nav-data.ts`.
 */
export {
  mainNav,
  opsNav,
  matchRouteKey,
  pathMatches,
  type NavKey,
  type SidebarNavLink as SidebarNavItem,
} from "./sidebar/sidebar-nav-data";
