import { z } from "zod";

import { ROLES } from "@/lib/constants";

export const loginSchema = z.object({
  username: z.string().trim().min(2, "Username is required"),
  password: z.string().min(6, "Password is too short"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const userCreateSchema = z.object({
  username: z.string().trim().min(2),
  password: z.string().min(8, "At least 8 characters"),
  role: z.enum(ROLES),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userRoleUpdateSchema = z.object({
  role: z.enum(ROLES),
});

export type UserRoleUpdateInput = z.infer<typeof userRoleUpdateSchema>;

export const userPasswordUpdateSchema = z.object({
  password: z.string().min(8, "At least 8 characters"),
});

export type UserPasswordUpdateInput = z.infer<typeof userPasswordUpdateSchema>;

export const profilePasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ProfilePasswordChangeInput = z.infer<
  typeof profilePasswordChangeSchema
>;
