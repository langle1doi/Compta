/** Browser API client: same-origin calls to /api/*, forwarded to the backend by the route handlers. */

export type ApiFieldError = {
  field: string;
  code: string;
  message: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: ApiFieldError[];
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: ApiFieldError[] = [],
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }
}

type QueryValue = string | number | undefined | null;

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** false for tenant-wide calls that must not be narrowed to the selected company. */
  withCompany?: boolean;
  /** Acts on this company instead of the selected one. */
  companyId?: string;
  /** false on the login form, where 401 means wrong credentials. */
  redirectOn401?: boolean;
};

let requestCompanyId: string | null = null;

/** Company sent as X-Company-Id. Set by SessionProvider, the only place that resolves it. */
export function setRequestCompanyId(id: string | null) {
  requestCompanyId = id;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  const locale = pathname.split("/")[1] || "fr";
  if (pathname === `/${locale}/login`) return;
  const next = encodeURIComponent(`${pathname}${search}`);
  window.location.assign(`/${locale}/login?next=${next}`);
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    withCompany = true,
    companyId,
    redirectOn401 = true,
  } = options;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  }
  const search = params.toString();

  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  const company = companyId ?? (withCompany ? requestCompanyId : null);
  if (company) headers["x-company-id"] = company;

  let response: Response;
  try {
    response = await fetch(`/api${path}${search ? `?${search}` : ""}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Network error");
  }

  if (response.status === 401 && redirectOn401) redirectToLogin();

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as {
    code?: string;
    message?: string;
    fields?: ApiFieldError[];
    request_id?: string;
  } | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.code ?? "UNKNOWN_ERROR",
      payload?.message ?? response.statusText,
      payload?.fields ?? [],
      payload?.request_id,
    );
  }

  return payload as T;
}
