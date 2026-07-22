import { z } from "zod";

const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return null;
    const date = typeof value === "string" ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const consultationSchema = z.object({
  visitId: z.string().min(1),
  reasonForVisit: z.string().default(""),
  hps: z.string().default(""),
  rs: z.string().default(""),
  pe: z.string().default(""),
  vitals: z.string().default(""),
  eco: z.string().default(""),
  bloodWork: z.string().default(""),
  clinicalNotes: z.string().default(""),
  diagnosis: z.string().default(""),
  prescribedTreatment: z.string().default(""),
  dosageInstructions: z.string().default(""),
  allergiesConsidered: z.string().default(""),
  followUpDate: optionalDate,
  notes: z.string().default(""),
  hasCnss: z.coerce.boolean().default(false),
});

export type ConsultationInput = z.infer<typeof consultationSchema>;

export const consultationUpdateSchema = consultationSchema.partial().extend({
  visitId: z.string().min(1),
});
export type ConsultationUpdateInput = z.infer<typeof consultationUpdateSchema>;
