import { z } from "zod";

import { ROLES } from "@/lib/constants";

export const loginSchema = z.object({
  username: z.string().trim().min(2, "Username is required").max(64),
  password: z.string().min(6, "Password is too short").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(64, "Username is too long")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username may only contain letters, numbers, dots, hyphens, and underscores"
    ),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128, "Password is too long"),
  role: z.enum(ROLES),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userRoleUpdateSchema = z.object({
  role: z.enum(ROLES),
});

export type UserRoleUpdateInput = z.infer<typeof userRoleUpdateSchema>;

export const userPasswordUpdateSchema = z.object({
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128, "Password is too long"),
});

export type UserPasswordUpdateInput = z.infer<typeof userPasswordUpdateSchema>;

export const profilePasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(128),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .max(128, "Password is too long"),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your new password")
      .max(128),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ProfilePasswordChangeInput = z.infer<
  typeof profilePasswordChangeSchema
>;
