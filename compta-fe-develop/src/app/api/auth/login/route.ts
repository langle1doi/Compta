import { NextResponse, type NextRequest } from "next/server";

import { forwardToBackend, hasBody, setSessionCookie } from "@/lib/api/backend";

/** Keeps the access token out of client JS: it only ever lives in an HttpOnly cookie. */
export async function POST(request: NextRequest) {
  const upstream = await forwardToBackend(request, "/auth/login");

  if (upstream.status === 200) {
    const { access_token: token } = JSON.parse(upstream.body.toString()) as {
      access_token: string;
    };
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, request, token);
    return response;
  }

  return new NextResponse(
    hasBody(upstream.status) ? new Uint8Array(upstream.body) : null,
    {
      status: upstream.status,
      headers: upstream.headers,
    },
  );
}
