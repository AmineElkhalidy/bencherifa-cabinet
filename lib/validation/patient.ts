import { z } from "zod";

import { GENDERS, INSURANCE_PROVIDERS } from "@/lib/constants";

export const patientSchema = z.object({
  name: z.string().trim().min(2, "Full name is required"),
  age: z
    .string()
    .trim()
    .min(1, "Age is required")
    .refine(
      (v) => {
        const n = parseInt(v, 10);
        return !isNaN(n) && n >= 0 && n <= 130;
      },
      { message: "Please enter a valid age (0–130)" }
    ),
  gender: z.enum(GENDERS),
  phoneNumber: z
    .string()
    .trim()
    .max(32, "Phone number is too long")
    .refine((v) => v.length === 0 || v.length >= 6, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  cin: z
    .string()
    .trim()
    .max(32, "CIN is too long")
    .optional()
    .or(z.literal("")),
  insuranceProvider: z.enum(INSURANCE_PROVIDERS).default("NONE"),
  surgicalHistory: z.string().default(""),
  allergies: z.string().default(""),
  contraindications: z.string().default(""),
});

export type PatientInput = z.infer<typeof patientSchema>;

export const patientUpdateSchema = patientSchema.partial();
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;
