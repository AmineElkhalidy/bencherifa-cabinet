"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/rbac";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
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
  const session = await requireRole("DOCTOR");

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
    select: { id: true, password: true },
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

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(parsed.data.newPassword) },
  });

  revalidatePath("/profile");
  revalidatePath("/settings/users");
  return { ok: true };
}
