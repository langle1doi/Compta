import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import {
  PLATFORM_SESSION_COOKIE,
  resolveHost,
  SESSION_COOKIE,
} from "./lib/api/host";

const handleI18nRouting = createMiddleware(routing);

function redirectTo(request: NextRequest, pathname: string, next?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = next ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const locale = routing.locales.find(
    (entry) => pathname === `/${entry}` || pathname.startsWith(`/${entry}/`),
  );

  // Paths without a locale are redirected by next-intl first and come back through here.
  if (locale) {
    const inner = pathname.slice(locale.length + 1) || "/";
    const isLogin = inner === "/login";
    const isPlatformPage =
      inner === "/platform" || inner.startsWith("/platform/");

    if (resolveHost(request.headers.get("host")).kind === "platform") {
      if (!isLogin && !isPlatformPage)
        return redirectTo(request, `/${locale}/platform`);
      if (isPlatformPage && !request.cookies.has(PLATFORM_SESSION_COOKIE)) {
        return redirectTo(request, `/${locale}/login`, `${pathname}${search}`);
      }
    } else {
      if (isPlatformPage) return redirectTo(request, `/${locale}`);
      if (!isLogin && !request.cookies.has(SESSION_COOKIE)) {
        return redirectTo(request, `/${locale}/login`, `${pathname}${search}`);
      }
    }
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
