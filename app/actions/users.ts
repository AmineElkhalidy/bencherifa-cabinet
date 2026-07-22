"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireRole } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import {
  userCreateSchema,
  userPasswordUpdateSchema,
  userRoleUpdateSchema,
} from "@/lib/validation/auth";

export type UserActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

function revalidateUsers() {
  revalidatePath("/settings/users");
  revalidatePath("/settings");
}

async function countDoctorsExcept(userId?: string) {
  return prisma.user.count({
    where: {
      role: "DOCTOR",
      ...(userId ? { id: { not: userId } } : {}),
    },
  });
}

export async function createUser(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireRole("DOCTOR");

  const parsed = userCreateSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      error: "Please correct the invalid fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.user.create({
      data: {
        username: parsed.data.username,
        password: await hashPassword(parsed.data.password),
        role: parsed.data.role,
      },
    });
    revalidateUsers();
    return { ok: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        error: "This username already exists.",
        fieldErrors: { username: ["Username already in use."] },
      };
    }
    console.error("[createUser]", err);
    return { error: "Server error. Please try again." };
  }
}

export async function updateUserRole(
  userId: string,
  role: string
): Promise<UserActionState> {
  const session = await requireRole("DOCTOR");
  const parsed = userRoleUpdateSchema.safeParse({ role });
  if (!parsed.success) {
    return { error: "Invalid role." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { error: "User not found." };
  }

  if (user.id === session.userId && parsed.data.role !== "DOCTOR") {
    return {
      error:
        "You cannot remove your own doctor access from this page.",
    };
  }

  if (user.role === "DOCTOR" && parsed.data.role !== "DOCTOR") {
    const otherDoctors = await countDoctorsExcept(user.id);
    if (otherDoctors === 0) {
      return { error: "Cannot remove the last doctor account." };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: parsed.data.role },
  });
  revalidateUsers();
  return { ok: true };
}

export async function updateUserPassword(
  userId: string,
  password: string
): Promise<UserActionState> {
  await requireRole("DOCTOR");
  const parsed = userPasswordUpdateSchema.safeParse({ password });
  if (!parsed.success) {
    return {
      error: "Password is too short.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { error: "User not found." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: await hashPassword(parsed.data.password) },
  });
  revalidateUsers();
  return { ok: true };
}

export async function deleteUser(userId: string): Promise<UserActionState> {
  const session = await requireRole("DOCTOR");

  if (userId === session.userId) {
    return { error: "You cannot delete your own account." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { error: "User not found." };
  }

  if (user.role === "DOCTOR") {
    const otherDoctors = await countDoctorsExcept(user.id);
    if (otherDoctors === 0) {
      return { error: "Cannot delete the last doctor account." };
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidateUsers();
  return { ok: true };
}
