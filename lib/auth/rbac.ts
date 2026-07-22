import "server-only";

import { redirect } from "next/navigation";

import type { Role } from "@/lib/constants";

import { readSession, type SessionPayload } from "./session";

/**
 * Read the current session — never throws. Use in non-critical UI bits
 * such as a header avatar.
 */
export async function getSession(): Promise<SessionPayload | null> {
  return readSession();
}

/**
 * Require any authenticated user. Redirects to /login if missing.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Strict role guard for Server Components, Server Actions, and Route
 * Handlers. Redirects unauthenticated users to /login and denies
 * everyone else with a 403-equivalent redirect to /forbidden.
 */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect("/forbidden");
  return session;
}

export function hasRole(session: SessionPayload | null, ...roles: Role[]) {
  return !!session && roles.includes(session.role);
}
