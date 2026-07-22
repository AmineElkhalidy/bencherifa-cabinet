import { z } from "zod";

import { DEFAULT_VISIT_PRICE, VISIT_STATUSES, VISIT_TYPES } from "@/lib/constants";

export const visitCreateSchema = z.object({
  patientId: z.string().min(1),
  visitType: z.enum(VISIT_TYPES).default("Consultation"),
  price: z.coerce.number().nonnegative().default(DEFAULT_VISIT_PRICE),
});

export type VisitCreateInput = z.infer<typeof visitCreateSchema>;

export const visitUpdateSchema = z.object({
  status: z.enum(VISIT_STATUSES).optional(),
  visitType: z.enum(VISIT_TYPES).optional(),
  price: z.coerce.number().nonnegative().optional(),
});

export type VisitUpdateInput = z.infer<typeof visitUpdateSchema>;
