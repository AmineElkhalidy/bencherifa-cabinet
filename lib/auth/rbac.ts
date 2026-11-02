import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { ROLES, type Role } from "@/lib/constants";
import { prisma } from "@/lib/db";

import {
  computePasswordTag,
  readSession,
  type SessionPayload,
} from "./session";

/**
 * Verifies the JWT cookie AND confirms the user still exists in the database
 * with matching role and password fingerprint. Deduplicated per request via
 * React `cache()` so multiple components/actions in one render only hit SQLite once.
 */
export const verifyActiveSession = cache(
  async (): Promise<SessionPayload | null> => {
    const session = await readSession();
    if (!session) return null;

    try {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, username: true, role: true, password: true },
      });

      if (!user) return null;
      if (!ROLES.includes(user.role as Role)) return null;

      // If the session carries a password fingerprint, verify it still matches
      // the current password hash in the database (invalidates old sessions on password change).
      const currentPwdTag = computePasswordTag(user.password);
      if (session.pwdTag && session.pwdTag !== currentPwdTag) {
        return null;
      }

      // Always use the authoritative role & username from the database
      return {
        userId: user.id,
        username: user.username,
        role: user.role as Role,
        pwdTag: currentPwdTag,
        expiresAt: session.expiresAt,
      };
    } catch {
      return null;
    }
  }
);

/**
 * Read the current verified session — never throws.
 */
export async function getSession(): Promise<SessionPayload | null> {
  return verifyActiveSession();
}

/**
 * Require any authenticated user. Redirects to /login if missing or revoked.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await verifyActiveSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Strict role guard for Server Components and Server Actions.
 * Redirects unauthenticated users to /login and unauthorized roles to /forbidden.
 */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await verifyActiveSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect("/forbidden");
  return session;
}

/**
 * Explicit error thrown by API Route Handler guards so route handlers can return
 * clean 401/403 JSON responses instead of HTML redirects.
 */
export class ApiAuthError extends Error {
  public readonly status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
  }
}

export async function requireApiAuth(): Promise<SessionPayload> {
  const session = await verifyActiveSession();
  if (!session) {
    throw new ApiAuthError(401, "Authentication required.");
  }
  return session;
}

export async function requireApiRole(
  ...roles: Role[]
): Promise<SessionPayload> {
  const session = await verifyActiveSession();
  if (!session) {
    throw new ApiAuthError(401, "Authentication required.");
  }
  if (!roles.includes(session.role)) {
    throw new ApiAuthError(403, "Insufficient permissions.");
  }
  return session;
}

export function hasRole(session: SessionPayload | null, ...roles: Role[]) {
  return !!session && roles.includes(session.role);
}
