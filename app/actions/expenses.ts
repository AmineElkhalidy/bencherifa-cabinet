"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { expenseSchema, expenseUpdateSchema } from "@/lib/validation/expense";

export type ExpenseActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

function revalidateExpenses() {
  revalidatePath("/doctor/expenses");
}

function parseExpenseForm(formData: FormData) {
  return {
    title: formData.get("title"),
    amount: formData.get("amount"),
    category: formData.get("category"),
    date: formData.get("date"),
    notes: formData.get("notes"),
  };
}

export async function createExpense(
  _prev: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  await requireRole("DOCTOR");

  const parsed = expenseSchema.safeParse(parseExpenseForm(formData));
  if (!parsed.success) {
    return {
      error: "Please correct the invalid fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.expense.create({
    data: {
      title: parsed.data.title,
      amount: parsed.data.amount,
      category: parsed.data.category,
      date: parsed.data.date,
      notes: parsed.data.notes,
    },
  });

  revalidateExpenses();
  return { ok: true };
}

export async function updateExpense(
  _prev: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  await requireRole("DOCTOR");

  const parsed = expenseUpdateSchema.safeParse({
    id: formData.get("id"),
    ...parseExpenseForm(formData),
  });

  if (!parsed.success) {
    return {
      error: "Please correct the invalid fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await prisma.expense.findUnique({
    where: { id: parsed.data.id },
  });
  if (!existing) {
    return { error: "Expense not found." };
  }

  await prisma.expense.update({
    where: { id: parsed.data.id },
    data: {
      title: parsed.data.title,
      amount: parsed.data.amount,
      category: parsed.data.category,
      date: parsed.data.date,
      notes: parsed.data.notes,
    },
  });

  revalidateExpenses();
  return { ok: true };
}

export async function deleteExpense(expenseId: string): Promise<ExpenseActionState> {
  await requireRole("DOCTOR");

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) {
    return { error: "Expense not found." };
  }

  await prisma.expense.delete({ where: { id: expenseId } });
  revalidateExpenses();
  return { ok: true };
}
