import { NextResponse, type NextRequest } from "next/server";

import { decryptSession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

/**
 * Optimistic auth + RBAC guard. The strict checks still happen server-side
 * inside requireAuth/requireRole — the proxy is just a fast redirect layer
 * (recommended pattern from node_modules/next/dist/docs/01-app/02-guides/authentication.md).
 *
 * Public:  /login, /forbidden, /api/auth/login, /api/health, static assets.
 * Doctor-only: /doctor/**, /settings/**.
 * Receptionist + Doctor: /reception/**.
 */

const PUBLIC_PATHS = ["/login", "/forbidden"];
const PUBLIC_API = ["/api/auth/login", "/api/health"];

const DOCTOR_ROUTES = [/^\/doctor(\/|$)/, /^\/settings(\/|$)/];
const RECEPTION_ROUTES = [/^\/reception(\/|$)/];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_API.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(token);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  const isDoctor = session.role === "DOCTOR";
  const isReception = session.role === "RECEPTIONIST";

  if (DOCTOR_ROUTES.some((rx) => rx.test(pathname)) && !isDoctor) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  if (
    RECEPTION_ROUTES.some((rx) => rx.test(pathname)) &&
    !isReception &&
    !isDoctor
  ) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on every route except Next internals, static files, and uploads served via API.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)).*)",
  ],
};
