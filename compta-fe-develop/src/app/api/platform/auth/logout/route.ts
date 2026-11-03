import { NextResponse, type NextRequest } from "next/server";

import { clearSessionCookie, requestHostContext } from "@/lib/api/backend";
import { PLATFORM_SESSION_COOKIE } from "@/lib/api/host";

export async function POST(request: NextRequest) {
  if (requestHostContext(request).kind !== "platform") {
    return NextResponse.json(
      { status_code: 404, code: "NOT_FOUND", message: "Not found" },
      { status: 404 },
    );
  }
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response, PLATFORM_SESSION_COOKIE);
  return response;
}
