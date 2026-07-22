"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Tag,
  Trash2,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  createExpense,
  deleteExpense,
  updateExpense,
  type ExpenseActionState,
} from "@/app/actions/expenses";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/constants";
import type { ExpenseRecord, ExpenseSummary } from "@/lib/expenses";
import { cn, formatMAD } from "@/lib/utils";

const ALL_CATEGORIES = "__all__";

type Props = {
  expenses: ExpenseRecord[];
  summary: ExpenseSummary;
};

function toDateInputValue(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "yyyy-MM-dd");
}

function categoryBadgeClass(category: ExpenseCategory) {
  switch (category) {
    case "Medical Equipment":
      return "bg-primary/10 text-primary";
    case "Consumables":
      return "bg-success/10 text-success";
    case "Utilities":
      return "bg-warning/15 text-warning-foreground";
    case "Rent":
      return "bg-muted text-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ExpensesDashboard({ expenses, summary }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);

  const filtered = useMemo(() => {
    if (categoryFilter === ALL_CATEGORIES) return expenses;
    return expenses.filter((expense) => expense.category === categoryFilter);
  }, [categoryFilter, expenses]);

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, expense) => sum + expense.amount, 0),
    [filtered]
  );

  const topCategoryLabel = summary.topCategory.category
    ? EXPENSE_CATEGORY_LABELS[summary.topCategory.category]
    : "—";

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total expenses (this month)"
          value={formatMAD(summary.monthTotal)}
          hint={format(new Date(), "MMMM yyyy", { locale: enUS })}
          icon={Wallet}
          tone="destructive"
        />
        <StatCard
          label="Highest expense category"
          value={topCategoryLabel}
          hint={
            summary.topCategory.total > 0
              ? `${formatMAD(summary.topCategory.total)} this month`
              : "No expenses this month"
          }
          icon={Tag}
          tone="warning"
        />
        <StatCard
          label="Total expenses (year)"
          value={formatMAD(summary.yearTotal)}
          hint={String(new Date().getFullYear())}
          icon={TrendingDown}
          tone="primary"
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Expense ledger
            </CardTitle>
            <CardDescription>
              {expenses.length} expense(s) recorded. Filter by category or add a
              new expense.
            </CardDescription>
          </div>
          <Button type="button" onClick={() => setAddOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" />
            Add expense
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="category-filter" className="text-sm text-muted-foreground">
                Category
              </Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter" className="w-[240px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {EXPENSE_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {filtered.length} row(s) shown
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <Receipt className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 font-medium">No expenses</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {categoryFilter === ALL_CATEGORIES
                  ? "Record your first clinic expense to get started."
                  : "No expenses in this category."}
              </p>
              <Button
                type="button"
                className="mt-4"
                variant="outline"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add expense
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-t border-border transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                        {format(new Date(expense.date), "MM/dd/yyyy", {
                          locale: enUS,
                        })}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium">{expense.title}</p>
                        {expense.notes ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {expense.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant="muted"
                          className={cn("font-normal", categoryBadgeClass(expense.category))}
                        >
                          {EXPENSE_CATEGORY_LABELS[expense.category]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right font-medium tabular-nums">
                        {formatMAD(expense.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditTarget(expense)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(expense)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/30">
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Displayed total
                    </td>
                    <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">
                      {formatMAD(filteredTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="create"
      />

      <ExpenseFormDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        mode="edit"
        expense={editTarget}
      />

      <DeleteExpenseDialog
        expense={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ExpenseFormDialog({
  open,
  onOpenChange,
  mode,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  expense?: ExpenseRecord | null;
}) {
  const router = useRouter();
  const action = mode === "create" ? createExpense : updateExpense;
  const [state, formAction, isPending] = useActionState<
    ExpenseActionState,
    FormData
  >(action, null);
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? "Consumables"
  );
  const handledStateRef = useRef<ExpenseActionState>(null);

  useEffect(() => {
    if (open && expense) {
      setCategory(expense.category);
    }
    if (open && mode === "create" && !expense) {
      setCategory("Consumables");
    }
  }, [open, expense, mode]);

  useEffect(() => {
    if (state === handledStateRef.current) return;
    handledStateRef.current = state;

    if (state?.ok) {
      toast.success(
        mode === "create" ? "Expense saved" : "Expense updated"
      );
      onOpenChange(false);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, mode, onOpenChange, router]);

  const defaultDate = expense
    ? toDateInputValue(expense.date)
    : toDateInputValue(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {mode === "create" ? "Add expense" : "Edit expense"}
          </DialogTitle>
          <DialogDescription>
            Record an outgoing clinic cost (supplies, equipment, bills, etc.).
          </DialogDescription>
        </DialogHeader>

        <form
          action={formAction}
          className="space-y-4 transition-opacity duration-200"
        >
          {mode === "edit" && expense ? (
            <input type="hidden" name="id" value={expense.id} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="expense-title">Title</Label>
            <Input
              id="expense-title"
              name="title"
              placeholder="e.g. Syringe purchase"
              defaultValue={expense?.title ?? ""}
              required
            />
            {state?.fieldErrors?.title?.[0] ? (
              <p className="text-xs text-destructive">{state.fieldErrors.title[0]}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount (MAD)</Label>
              <Input
                id="expense-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                defaultValue={expense?.amount ?? ""}
                required
              />
              {state?.fieldErrors?.amount?.[0] ? (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.amount[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                name="date"
                type="date"
                defaultValue={defaultDate}
                required
              />
              {state?.fieldErrors?.date?.[0] ? (
                <p className="text-xs text-destructive">{state.fieldErrors.date[0]}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as ExpenseCategory)}
            >
              <SelectTrigger id="expense-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {EXPENSE_CATEGORY_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="category" value={category} />
            {state?.fieldErrors?.category?.[0] ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.category[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-notes">Notes (optional)</Label>
            <Textarea
              id="expense-notes"
              name="notes"
              rows={3}
              placeholder="Details, vendor, invoice number…"
              defaultValue={expense?.notes ?? ""}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "create" ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              {mode === "create" ? "Save" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteExpenseDialog({
  expense,
  onClose,
}: {
  expense: ExpenseRecord | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!expense) return;
    startTransition(async () => {
      const result = await deleteExpense(expense.id);
      if (result?.ok) {
        toast.success("Expense deleted");
        onClose();
        router.refresh();
      } else {
        toast.error(result?.error ?? "Could not delete expense");
      }
    });
  }

  return (
    <Dialog open={!!expense} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this expense?</DialogTitle>
          <DialogDescription>
            {expense
              ? `"${expense.title}" (${formatMAD(expense.amount)}) will be permanently removed.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
