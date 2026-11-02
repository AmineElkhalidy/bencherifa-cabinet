"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  computePasswordTag,
  createSessionCookie,
  destroySessionCookie,
} from "@/lib/auth/session";
import { verifyDummyPassword, verifyPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  recordFailedLogin,
} from "@/lib/auth/rate-limit";
import { ROLES } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = {
  error?: string;
  fieldErrors?: { username?: string[]; password?: string[] };
} | null;

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }
    return h.get("x-real-ip") ?? "local";
  } catch {
    return "local";
  }
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: "Please correct the highlighted fields.",
    };
  }

  const normalizedUsername = parsed.data.username.toLowerCase();
  const clientIp = await getClientIp();
  const rateKeyIp = `ip:${clientIp}`;
  const rateKeyUser = `user:${normalizedUsername}`;

  const ipCheck = checkLoginRateLimit(rateKeyIp);
  const userCheck = checkLoginRateLimit(rateKeyUser);
  if (!ipCheck.allowed || !userCheck.allowed) {
    const waitSec = Math.max(
      ipCheck.retryAfterSeconds ?? 0,
      userCheck.retryAfterSeconds ?? 0
    );
    const waitMin = Math.max(1, Math.ceil(waitSec / 60));
    logger.warn("auth", "Rate-limited login attempt", {
      ip: clientIp,
      username: normalizedUsername,
    });
    return {
      error: `Too many failed login attempts. Please try again in ${waitMin} minute(s).`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });

  if (!user) {
    // Perform a dummy bcrypt comparison so non-existent usernames take the
    // same CPU time as existing accounts (mitigates timing-based username enumeration).
    await verifyDummyPassword(parsed.data.password);
    recordFailedLogin(rateKeyIp);
    recordFailedLogin(rateKeyUser);
    logger.warn("auth", "Failed login (unknown username)", {
      ip: clientIp,
    });
    return { error: "Invalid credentials." };
  }

  const valid = await verifyPassword(parsed.data.password, user.password);
  if (!valid) {
    recordFailedLogin(rateKeyIp);
    recordFailedLogin(rateKeyUser);
    logger.warn("auth", "Failed login (invalid password)", {
      ip: clientIp,
      userId: user.id,
    });
    return { error: "Invalid credentials." };
  }

  if (!ROLES.includes(user.role as (typeof ROLES)[number])) {
    return { error: "Invalid user role. Contact the administrator." };
  }

  clearLoginRateLimit(rateKeyIp);
  clearLoginRateLimit(rateKeyUser);

  await createSessionCookie({
    userId: user.id,
    username: user.username,
    role: user.role as (typeof ROLES)[number],
    pwdTag: computePasswordTag(user.password),
  });

  logger.info("auth", "User logged in", {
    userId: user.id,
    role: user.role,
  });

  redirect(user.role === "DOCTOR" ? "/doctor" : "/reception");
}

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/login");
}
