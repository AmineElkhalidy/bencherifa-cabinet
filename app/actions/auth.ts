"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  createSessionCookie,
  destroySessionCookie,
} from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { ROLES } from "@/lib/constants";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = {
  error?: string;
  fieldErrors?: { username?: string[]; password?: string[] };
} | null;

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

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });
  if (!user) {
    return { error: "Invalid credentials." };
  }

  const valid = await verifyPassword(parsed.data.password, user.password);
  if (!valid) {
    return { error: "Invalid credentials." };
  }

  if (!ROLES.includes(user.role as (typeof ROLES)[number])) {
    return { error: "Invalid user role. Contact the administrator." };
  }

  await createSessionCookie({
    userId: user.id,
    username: user.username,
    role: user.role as (typeof ROLES)[number],
  });

  redirect(user.role === "DOCTOR" ? "/doctor" : "/reception");
}

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/login");
}
