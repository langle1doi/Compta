import type { DataScope } from '../../generated/tenant/enums';
import type { AuthUser } from '../auth/auth.types';

/** Fields attached to the Express request along the pipeline (middleware -> guards). */
export interface RequestContext {
  /** Real client address: X-Client-Ip when sent by the trusted frontend proxy, else the socket */
  clientIp?: string;
  /** Set by TenantResolverMiddleware */
  tenant?: { id: string; subdomain: string };
  /** Set by JwtAuthGuard */
  user?: AuthUser;
  /** Set by PermissionGuard */
  access?: { userId: string; companyId: string | null; scope: DataScope };
}
