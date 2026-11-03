import http from "node:http";
import https from "node:https";

import type { NextRequest, NextResponse } from "next/server";

import { PLATFORM_SESSION_COOKIE, resolveHost, SESSION_COOKIE } from "./host";

/** Server-side only: the browser talks to this app, which forwards to the backend. */
const TENANT_API_PREFIX = "/api/v1";
const PLATFORM_API_PREFIX = "/platform/api/v1";
const TIMEOUT_MS = 30_000;
// Creating a tenant provisions its database while the request stays open.
const PLATFORM_TIMEOUT_MS = 5 * 60_000;

// Everything else from the client is dropped: hop-by-hop headers, X-Forwarded-*, Cookie, Authorization.
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "x-company-id",
  "x-request-id",
];
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "x-request-id",
  "retry-after",
];

type BackendResponse = {
  status: number;
  headers: Headers;
  body: Buffer;
};

function backendBaseDomain() {
  return process.env.APP_BASE_DOMAIN || "localhost";
}

function requestBackend(
  method: string,
  path: string,
  host: string,
  headers: Record<string, string>,
  timeout: number,
  body?: Buffer,
): Promise<BackendResponse> {
  const target = new URL(process.env.BACKEND_URL || "http://127.0.0.1:3000");
  const client = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    // node:http because fetch does not send a custom Host header.
    const request = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method,
        path,
        headers: {
          ...headers,
          host,
          ...(body?.length ? { "content-length": String(body.length) } : {}),
        },
        timeout,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () => {
          const forwarded = new Headers();
          for (const name of FORWARDED_RESPONSE_HEADERS) {
            const value = response.headers[name];
            if (typeof value === "string") forwarded.set(name, value);
          }
          resolve({
            status: response.statusCode ?? 502,
            headers: forwarded,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("Backend timeout")));
    request.on("error", reject);
    if (body?.length) request.write(body);
    request.end();
  });
}

function jsonError(
  status: number,
  code: string,
  message: string,
): BackendResponse {
  return {
    status,
    headers: new Headers({ "content-type": "application/json" }),
    body: Buffer.from(JSON.stringify({ status_code: status, code, message })),
  };
}

async function forward(
  request: NextRequest,
  {
    path,
    host,
    cookie,
    timeout,
  }: { path: string; host: string; cookie: string; timeout: number },
) {
  const headers: Record<string, string> = {};
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  // Each side only ever reads its own cookie: a token cannot reach the other API.
  const token = request.cookies.get(cookie)?.value;
  if (token) headers.authorization = `Bearer ${token}`;

  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : Buffer.from(await request.arrayBuffer());

  try {
    return await requestBackend(
      request.method,
      path,
      host,
      headers,
      timeout,
      body,
    );
  } catch {
    return jsonError(502, "BACKEND_UNAVAILABLE", "Backend is not reachable");
  }
}

export function requestHostContext(request: NextRequest) {
  return resolveHost(request.headers.get("host"));
}

/** Tenant API, for the tenant named by the request's Host. Never reachable from the platform host. */
export async function forwardToBackend(request: NextRequest, path: string) {
  const context = requestHostContext(request);
  if (context.kind === "invalid")
    return jsonError(404, "TENANT_NOT_FOUND", "Tenant not found");
  if (context.kind === "platform")
    return jsonError(404, "NOT_FOUND", "Not found");

  return forward(request, {
    path: `${TENANT_API_PREFIX}${path}`,
    host: `${context.tenant}.${backendBaseDomain()}`,
    cookie: SESSION_COOKIE,
    timeout: TIMEOUT_MS,
  });
}

/** Platform API on the bare base domain. Only reachable from the platform host. */
export async function forwardToPlatform(request: NextRequest, path: string) {
  if (requestHostContext(request).kind !== "platform") {
    return jsonError(404, "NOT_FOUND", "Not found");
  }

  return forward(request, {
    path: `${PLATFORM_API_PREFIX}${path}`,
    host: backendBaseDomain(),
    cookie: PLATFORM_SESSION_COOKIE,
    timeout: PLATFORM_TIMEOUT_MS,
  });
}

export function hasBody(status: number) {
  return status !== 204 && status !== 304;
}

/** Secure only over HTTPS in production: `next start` also serves plain HTTP on the LAN. */
function isSecureRequest(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return false;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  return proto.split(",")[0]?.trim() === "https";
}

/** Seconds until the JWT expires, so the cookie never outlives the token. */
function tokenMaxAge(token: string) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString(),
    );
    if (typeof payload.exp !== "number") return undefined;
    return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  } catch {
    return undefined;
  }
}

/** No Domain attribute: host-only, so tenants and the platform never share a session. */
export function setSessionCookie(
  response: NextResponse,
  request: NextRequest,
  token: string,
  name: string = SESSION_COOKIE,
) {
  response.cookies.set(name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: tokenMaxAge(token),
  });
}

export function clearSessionCookie(
  response: NextResponse,
  name: string = SESSION_COOKIE,
) {
  response.cookies.delete(name);
}
