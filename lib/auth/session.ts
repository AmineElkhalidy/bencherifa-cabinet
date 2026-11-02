import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { SESSION_COOKIE_NAME, type Role } from "@/lib/constants";

export type SessionPayload = {
  userId: string;
  username: string;
  role: Role;
  pwdTag?: string; // Short digest of password hash to detect password changes
  expiresAt: number; // epoch ms
};

const ALG = "HS256";

const INSECURE_DEFAULTS = new Set([
  "replace-me-with-a-strong-random-base64-string",
  "changeme",
  "secret",
  "development-secret",
]);

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32 || INSECURE_DEFAULTS.has(secret.toLowerCase())) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is missing, too short (<32 chars), or uses an insecure default in production."
      );
    }
    if (!secret || secret.length < 16) {
      throw new Error(
        "SESSION_SECRET is not configured. Set a strong base64 string (>=32 chars) in your .env file."
      );
    }
  }
  return new TextEncoder().encode(secret);
}

function getMaxAgeMs(): number {
  const days = Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);
  return Math.max(1, Math.min(30, days)) * 24 * 60 * 60 * 1000;
}

/**
 * Computes a short, non-reversible fingerprint of the user's bcrypt hash so
 * that changing a user's password immediately invalidates all prior tokens.
 */
export function computePasswordTag(passwordHash: string): string {
  return createHash("sha256")
    .update(passwordHash)
    .digest("base64url")
    .slice(0, 16);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(getSecret());
}

export async function decryptSession(
  token?: string | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    if (
      typeof payload.userId === "string" &&
      typeof payload.username === "string" &&
      (payload.role === "DOCTOR" || payload.role === "RECEPTIONIST") &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt > Date.now()
    ) {
      return {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
        pwdTag: typeof payload.pwdTag === "string" ? payload.pwdTag : undefined,
        expiresAt: payload.expiresAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function createSessionCookie(
  input: Omit<SessionPayload, "expiresAt">
) {
  const expiresAt = Date.now() + getMaxAgeMs();
  const token = await encryptSession({ ...input, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_INSECURE_SESSION !== "true",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function destroySessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return decryptSession(token);
}
