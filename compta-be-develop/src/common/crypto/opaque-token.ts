import { createHash, randomBytes } from 'node:crypto';

/** 256-bit random token for links and refresh tokens. Only its hash is ever stored. */
export const generateOpaqueToken = () => randomBytes(32).toString('base64url');

/** SHA-256 is enough here: the input is high-entropy random, never a user-chosen secret. */
export const hashOpaqueToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** `<tenant id>.<random>`: the token alone names its tenant, so it also works on a host without subdomain. */
export const generateTenantToken = (tenantId: string) => `${tenantId}.${generateOpaqueToken()}`;

/** Tenant id a token claims to belong to; the token is still checked in that tenant's database. */
export function tenantIdOfToken(token: string): string | null {
  const [tenantId, random, extra] = token.split('.');
  return random && extra === undefined && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)
    ? tenantId
    : null;
}
