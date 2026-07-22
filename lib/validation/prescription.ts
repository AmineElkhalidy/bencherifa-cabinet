import { z } from "zod";

const doseField = z.coerce.number().int().min(0).max(9);

const prescriptionItemRawSchema = z.object({
  medication: z.string().trim(),
  medicationType: z.string().trim(),
  duration: z.string().trim(),
  doseMorning: doseField.default(0),
  doseNoon: doseField.default(0),
  doseEvening: doseField.default(0),
});

export const prescriptionItemSchema = prescriptionItemRawSchema.extend({
  medication: z.string().trim().min(1, "Medication name is required."),
  duration: z.string().trim().min(1, "Treatment duration is required."),
});

const prescriptionDateField = z
  .union([z.string(), z.date()])
  .transform((value) => {
    const date = typeof value === "string" ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? new Date() : date;
  });

export const prescriptionDraftSchema = z.object({
  visitId: z.string().min(1),
  prescriptionDate: prescriptionDateField,
  items: z.array(prescriptionItemRawSchema).max(20),
});

export const prescriptionSchema = prescriptionDraftSchema.extend({
  items: z
    .array(prescriptionItemSchema)
    .min(1, "Add at least one medication.")
    .max(20),
});

export type PrescriptionInput = z.infer<typeof prescriptionSchema>;
export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;
export type PrescriptionDraftInput = z.infer<typeof prescriptionDraftSchema>;
