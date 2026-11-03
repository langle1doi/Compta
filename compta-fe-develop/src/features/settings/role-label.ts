import type { Role } from "./types";

/** Prefer literal custom labels; fall back to i18n keys for system roles. */
export function roleDisplayName(
  role: Pick<Role, "label" | "nameKey">,
  t: (key: string) => string,
): string {
  if (role.label?.trim()) return role.label.trim();
  return t(role.nameKey);
}

export function roleDisplayDescription(
  role: Role,
  t: (key: string) => string,
): string {
  if (role.description?.trim()) return role.description.trim();
  return t(role.descriptionKey);
}
