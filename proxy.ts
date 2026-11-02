import { NextResponse, type NextRequest } from "next/server";

import { decryptSession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

/**
 * Optimistic auth + RBAC guard and security headers layer.
 * Strict database-backed checks still happen server-side inside
 * requireAuth / requireRole / requireApiAuth / requireApiRole.
 *
 * Public:  /login, /forbidden, /api/health, static assets.
 * Doctor-only: /doctor/**, /settings/**.
 * Receptionist + Doctor: /reception/**, /profile.
 */

const PUBLIC_PATHS = ["/login", "/forbidden"];
const PUBLIC_API = ["/api/health"];

const DOCTOR_ROUTES = [/^\/doctor(\/|$)/, /^\/settings(\/|$)/];
const RECEPTION_ROUTES = [/^\/reception(\/|$)/, /^\/profile(\/|$)/];

function applySecurityHeaders(
  response: NextResponse,
  pathname: string
): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_INSECURE_SESSION !== "true"
  ) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  // Prevent browser/proxy caching of confidential medical pages and APIs
  if (!PUBLIC_PATHS.includes(pathname) && pathname !== "/api/health") {
    if (!response.headers.has("Cache-Control")) {
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
      );
    }
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  // Basic CSRF origin verification for state-changing API requests
  if (
    isApiRoute &&
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.method !== "OPTIONS"
  ) {
    const origin = request.headers.get("origin");
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return applySecurityHeaders(
            NextResponse.json(
              { error: "Cross-origin request forbidden." },
              { status: 403 }
            ),
            pathname
          );
        }
      } catch {
        return applySecurityHeaders(
          NextResponse.json({ error: "Invalid Origin header." }, { status: 403 }),
          pathname
        );
      }
    }
  }

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_API.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(token);

  if (!session) {
    if (isApiRoute) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Authentication required." }, { status: 401 }),
        pathname
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return applySecurityHeaders(NextResponse.redirect(url), pathname);
  }

  const isDoctor = session.role === "DOCTOR";
  const isReception = session.role === "RECEPTIONIST";

  if (DOCTOR_ROUTES.some((rx) => rx.test(pathname)) && !isDoctor) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/forbidden", request.url)),
      pathname
    );
  }

  if (
    RECEPTION_ROUTES.some((rx) => rx.test(pathname)) &&
    !isReception &&
    !isDoctor
  ) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/forbidden", request.url)),
      pathname
    );
  }

  return applySecurityHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)).*)",
  ],
};
