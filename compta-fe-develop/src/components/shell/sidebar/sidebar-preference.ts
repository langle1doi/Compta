/** Shared by client storage + SSR cookie so reload keeps the last desktop state. */
export const SIDEBAR_DESKTOP_OPEN_KEY = "compte.sidebar.desktopOpen";

export function parseDesktopOpenCookie(
  value: string | undefined | null,
): boolean {
  if (value === "0") return false;
  if (value === "1") return true;
  return true;
}
