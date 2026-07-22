import { startOfMonth, startOfYear } from "date-fns";

import type { ExpenseCategory } from "@/lib/constants";

export type ExpenseRecord = {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  notes: string;
};

export type ExpenseSummary = {
  monthTotal: number;
  yearTotal: number;
  topCategory: { category: ExpenseCategory | null; total: number };
};

export function summarizeExpenses(
  expenses: ExpenseRecord[],
  now: Date = new Date()
): ExpenseSummary {
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  let monthTotal = 0;
  let yearTotal = 0;
  const monthByCategory = new Map<ExpenseCategory, number>();

  for (const expense of expenses) {
    const date = new Date(expense.date);
    if (date >= yearStart) {
      yearTotal += expense.amount;
    }
    if (date >= monthStart) {
      monthTotal += expense.amount;
      monthByCategory.set(
        expense.category,
        (monthByCategory.get(expense.category) ?? 0) + expense.amount
      );
    }
  }

  let topCategory: ExpenseSummary["topCategory"] = { category: null, total: 0 };
  for (const [category, total] of monthByCategory) {
    if (total > topCategory.total) {
      topCategory = { category, total };
    }
  }

  return { monthTotal, yearTotal, topCategory };
}
