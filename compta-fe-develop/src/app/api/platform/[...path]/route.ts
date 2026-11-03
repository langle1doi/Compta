import { NextResponse, type NextRequest } from "next/server";

import {
  clearSessionCookie,
  forwardToPlatform,
  hasBody,
} from "@/lib/api/backend";
import { PLATFORM_SESSION_COOKIE } from "@/lib/api/host";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, { params }: Context) {
  const { path } = await params;
  if (path.some((segment) => segment === "." || segment === "..")) {
    return NextResponse.json(
      { status_code: 400, code: "BAD_REQUEST", message: "Invalid path" },
      { status: 400 },
    );
  }

  const target = `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const upstream = await forwardToPlatform(request, target);
  const response = new NextResponse(
    hasBody(upstream.status) ? new Uint8Array(upstream.body) : null,
    { status: upstream.status, headers: upstream.headers },
  );
  if (upstream.status === 401) {
    clearSessionCookie(response, PLATFORM_SESSION_COOKIE);
  }
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
