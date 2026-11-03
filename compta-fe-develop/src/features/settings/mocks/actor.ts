import { systemRoles } from "./roles";
import type { PermissionId } from "../types";

/** Mock signed-in actor = Tenant admin (UI gates only; replace with API later). */
export const MOCK_ACTOR_PERMISSIONS: readonly PermissionId[] =
  systemRoles.find((role) => role.id === "tenant-admin")?.permissions ?? [];
