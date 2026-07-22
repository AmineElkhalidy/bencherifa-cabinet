import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { SESSION_COOKIE_NAME, type Role } from "@/lib/constants";

export type SessionPayload = {
  userId: string;
  username: string;
  role: Role;
  expiresAt: number; // epoch ms
};

const ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is not configured. Set a strong base64 string in your .env file."
    );
  }
  return new TextEncoder().encode(secret);
}

function getMaxAgeMs(): number {
  const days = Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);
  return Math.max(1, days) * 24 * 60 * 60 * 1000;
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(getSecret());
}

export async function decryptSession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (
      typeof payload.userId === "string" &&
      typeof payload.username === "string" &&
      typeof payload.role === "string" &&
      typeof payload.expiresAt === "number"
    ) {
      return payload as unknown as SessionPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export async function createSessionCookie(input: Omit<SessionPayload, "expiresAt">) {
  const expiresAt = Date.now() + getMaxAgeMs();
  const token = await encryptSession({ ...input, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_SESSION !== "true",
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
