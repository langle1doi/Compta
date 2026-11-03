/**
 * @deprecated Shell now lives in `(app)/layout` via `AppShell`.
 * This alias only forwards children so leftover imports never nest a second chrome.
 */
export function WorkspaceChrome({
  children,
}: {
  active?: "overview" | "quotes" | "activity" | "settings";
  title?: string;
  children: React.ReactNode;
}) {
  return children;
}
