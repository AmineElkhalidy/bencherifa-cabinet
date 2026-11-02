"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/rbac";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { computePasswordTag, createSessionCookie } from "@/lib/auth/session";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { profilePasswordChangeSchema } from "@/lib/validation/auth";

export type ProfileActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

export async function changeOwnPassword(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await requireAuth();

  const parsed = profilePasswordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      error: "Please correct the invalid fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, role: true, password: true },
  });

  if (!user) {
    return { error: "Account not found." };
  }

  const currentValid = await verifyPassword(
    parsed.data.currentPassword,
    user.password
  );

  if (!currentValid) {
    return {
      error: "Current password is incorrect.",
      fieldErrors: { currentPassword: ["Incorrect password."] },
    };
  }

  const newPasswordHash = await hashPassword(parsed.data.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: newPasswordHash },
  });

  // Re-issue the current user's session cookie with the new password tag so
  // the current browser stays signed in while all other sessions are invalidated.
  await createSessionCookie({
    userId: user.id,
    username: user.username,
    role: user.role as (typeof ROLES)[number],
    pwdTag: computePasswordTag(newPasswordHash),
  });

  logger.info("auth", "User changed own password", { userId: user.id });

  revalidatePath("/profile");
  revalidatePath("/settings/users");
  return { ok: true };
}
