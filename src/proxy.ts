import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect only: checks that a session cookie exists.
 * Real authentication and permission checks happen in the backend on every request.
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  const { pathname } = request.nextUrl;

  if (!hasSession && pathname !== "/login") {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // Never bounce away from /login based on the cookie alone: a stale or revoked session cookie would
  // loop (/ -> backend 401 -> /login -> /). The login page itself redirects once sign-in succeeds.
  return NextResponse.next();
}

export const config = {
  // Skip API calls, Next internals and public files (logo, icons) so signed-out pages can load them.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:jpg|jpeg|png|svg|webp|gif|ico|txt)$).*)"],
};
