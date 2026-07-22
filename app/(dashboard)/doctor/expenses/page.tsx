import { Header } from "@/components/layout/header";
import { ExpensesDashboard } from "@/components/expenses/expenses-dashboard";
import { requireRole } from "@/lib/auth/rbac";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { summarizeExpenses, type ExpenseRecord } from "@/lib/expenses";

export const metadata = { title: "Expense management" };

function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export default async function ExpensesPage() {
  const session = await requireRole("DOCTOR");

  const rows = await prisma.expense.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const expenses: ExpenseRecord[] = rows
    .filter((row) => isExpenseCategory(row.category))
    .map((row) => ({
      id: row.id,
      title: row.title,
      amount: row.amount,
      category: row.category as ExpenseCategory,
      date: row.date.toISOString(),
      notes: row.notes,
    }));

  const summary = summarizeExpenses(expenses);

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="Expense management"
        description="Track clinic outgoing costs: supplies, equipment, utility bills, rent, and more."
      />
      <div className="flex-1 overflow-auto p-6">
        <ExpensesDashboard expenses={expenses} summary={summary} />
      </div>
    </>
  );
}
