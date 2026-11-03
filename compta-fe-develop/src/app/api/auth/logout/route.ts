import { NextResponse, type NextRequest } from "next/server";

import { clearSessionCookie, requestHostContext } from "@/lib/api/backend";

/** The backend has no logout endpoint yet: signing out drops the cookie on this side only. */
export async function POST(request: NextRequest) {
  if (requestHostContext(request).kind === "platform") {
    return NextResponse.json(
      { status_code: 404, code: "NOT_FOUND", message: "Not found" },
      { status: 404 },
    );
  }
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
