import { z } from "zod";

import { EXPENSE_CATEGORIES } from "@/lib/constants";

export const expenseSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  category: z.enum(EXPENSE_CATEGORIES, { message: "Invalid category." }),
  date: z.coerce.date({ message: "Invalid date." }),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? ""),
});

export const expenseUpdateSchema = expenseSchema.extend({
  id: z.string().min(1),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
