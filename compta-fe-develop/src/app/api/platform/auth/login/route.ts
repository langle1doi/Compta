import { NextResponse, type NextRequest } from "next/server";

import {
  forwardToPlatform,
  hasBody,
  setSessionCookie,
} from "@/lib/api/backend";
import { PLATFORM_SESSION_COOKIE } from "@/lib/api/host";

/** Same as the tenant login, with a cookie of its own. */
export async function POST(request: NextRequest) {
  const upstream = await forwardToPlatform(request, "/auth/login");

  if (upstream.status === 200) {
    const { access_token: token } = JSON.parse(upstream.body.toString()) as {
      access_token: string;
    };
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, request, token, PLATFORM_SESSION_COOKIE);
    return response;
  }

  return new NextResponse(
    hasBody(upstream.status) ? new Uint8Array(upstream.body) : null,
    { status: upstream.status, headers: upstream.headers },
  );
}
