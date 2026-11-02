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

const clinicalText = z.string().max(10000, "Field exceeds maximum length").default("");

export const consultationSchema = z.object({
  visitId: z.string().min(1).max(64),
  reasonForVisit: clinicalText,
  hps: clinicalText,
  rs: clinicalText,
  pe: clinicalText,
  vitals: clinicalText,
  eco: clinicalText,
  bloodWork: clinicalText,
  clinicalNotes: clinicalText,
  diagnosis: z.string().max(500, "Diagnosis is too long").default(""),
  prescribedTreatment: clinicalText,
  dosageInstructions: clinicalText,
  allergiesConsidered: clinicalText,
  followUpDate: optionalDate,
  notes: clinicalText,
  hasCnss: z.coerce.boolean().default(false),
});

export type ConsultationInput = z.infer<typeof consultationSchema>;

export const consultationUpdateSchema = consultationSchema.partial().extend({
  visitId: z.string().min(1).max(64),
});
export type ConsultationUpdateInput = z.infer<typeof consultationUpdateSchema>;
