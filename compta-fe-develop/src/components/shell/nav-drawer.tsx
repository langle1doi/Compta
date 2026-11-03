/**
 * @deprecated Use `@/components/shell/sidebar` instead.
 * Kept as thin aliases so older imports keep typechecking during the migration.
 */
export {
  SidebarProvider as NavDrawerProvider,
  SidebarTrigger as NavDrawerTrigger,
  SidebarSearch as NavDrawerSearch,
} from "./sidebar";

/** @deprecated Off-canvas + desktop rail now live in SidebarBody. */
export function NavDrawer(_props: {
  breakpoint?: "lg" | "xl";
  className?: string;
  closeLabel?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  return null;
}
