/** Which tenant or portal a request addresses, from its Host header. Safe to load in proxy.ts. */

export const SESSION_COOKIE = "compte_session";
export const PLATFORM_SESSION_COOKIE = "compte_platform_session";

const PLATFORM_SUBDOMAIN = "platform";
const SUBDOMAIN_LABEL = /^[a-z0-9-]+$/;

export type HostContext =
  | { kind: "tenant"; tenant: string }
  | { kind: "platform" }
  /** Under a public domain but not a single valid label: must not fall back to the default tenant. */
  | { kind: "invalid" };

function hostnameOf(host: string | null) {
  if (!host) return "";
  try {
    return new URL(`http://${host}`).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

function publicBaseDomains() {
  return (process.env.FE_BASE_DOMAINS || "localhost")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

/**
 * <tenant>.<public base domain> selects the tenant. Anything else, such as an IP address or a
 * machine name, gets TENANT_SUBDOMAIN. X-Forwarded-Host is deliberately not considered.
 */
export function resolveHost(host: string | null): HostContext {
  const hostname = hostnameOf(host);
  const base = publicBaseDomains().find((domain) =>
    hostname.endsWith(`.${domain}`),
  );

  if (!base)
    return { kind: "tenant", tenant: process.env.TENANT_SUBDOMAIN || "dfm" };

  const subdomain = hostname.slice(0, -(base.length + 1));
  if (!SUBDOMAIN_LABEL.test(subdomain)) return { kind: "invalid" };
  return subdomain === PLATFORM_SUBDOMAIN
    ? { kind: "platform" }
    : { kind: "tenant", tenant: subdomain };
}
