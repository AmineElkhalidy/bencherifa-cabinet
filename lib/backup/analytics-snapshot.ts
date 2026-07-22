import "server-only";

import { addDays, format, startOfDay, startOfMonth, startOfYear, subDays } from "date-fns";

import type { ExpenseCategory } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { summarizeExpenses } from "@/lib/expenses";

export type AnalyticsKpiRow = {
  metric: string;
  value: string;
  period: string;
};

export type AnalyticsDailyRow = {
  date: string;
  visits: number;
  revenueMad: number;
};

export type AnalyticsDiagnosisRow = {
  diagnosis: string;
  cases: number;
  sharePct: number;
};

export async function buildAnalyticsSnapshot(now: Date = new Date()) {
  const today = startOfDay(now);
  const last30 = subDays(today, 29);
  const last90 = subDays(today, 89);

  const [visits, topDiagnoses, expenses] = await Promise.all([
    prisma.visit.findMany({
      where: { date: { gte: last30 } },
      select: { date: true, status: true, price: true },
    }),
    prisma.consultation.groupBy({
      by: ["diagnosis"],
      _count: { _all: true },
      where: {
        diagnosis: { not: "" },
        createdAt: { gte: last90 },
      },
      orderBy: { _count: { diagnosis: "desc" } },
      take: 10,
    }),
    prisma.expense.findMany({ orderBy: { date: "asc" } }),
  ]);

  const completed = visits.filter((v) => v.status === "Completed");
  const revenue = visits.reduce((s, v) => s + v.price, 0);
  const expenseSummary = summarizeExpenses(
    expenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      category: e.category as ExpenseCategory,
      date: e.date.toISOString(),
      notes: e.notes,
    })),
    now
  );

  const daysMap = new Map<string, { count: number; revenue: number }>();
  for (let i = 0; i < 30; i++) {
    const d = format(addDays(last30, i), "yyyy-MM-dd");
    daysMap.set(d, { count: 0, revenue: 0 });
  }
  for (const v of visits) {
    const k = format(v.date, "yyyy-MM-dd");
    const slot = daysMap.get(k);
    if (!slot) continue;
    slot.count += 1;
    slot.revenue += v.price;
  }

  const daily: AnalyticsDailyRow[] = Array.from(daysMap.entries()).map(
    ([date, value]) => ({
      date,
      visits: value.count,
      revenueMad: Math.round(value.revenue * 100) / 100,
    })
  );

  const totalDiagnosisCases = topDiagnoses.reduce(
    (s, d) => s + d._count._all,
    0
  );
  const diagnoses: AnalyticsDiagnosisRow[] = topDiagnoses.map((d) => ({
    diagnosis: d.diagnosis,
    cases: d._count._all,
    sharePct:
      totalDiagnosisCases > 0
        ? Math.round((d._count._all / totalDiagnosisCases) * 1000) / 10
        : 0,
  }));

  const kpis: AnalyticsKpiRow[] = [
    {
      metric: "Visits (30 days)",
      value: String(visits.length),
      period: "last 30 days",
    },
    {
      metric: "Completed visits (30 days)",
      value: String(completed.length),
      period: "last 30 days",
    },
    {
      metric: "Visit revenue MAD (30 days)",
      value: String(Math.round(revenue * 100) / 100),
      period: "last 30 days",
    },
    {
      metric: "Top diagnosis (90 days)",
      value: topDiagnoses[0]?.diagnosis ?? "—",
      period: "last 90 days",
    },
    {
      metric: "Expenses MAD (month)",
      value: String(Math.round(expenseSummary.monthTotal * 100) / 100),
      period: format(startOfMonth(now), "yyyy-MM"),
    },
    {
      metric: "Expenses MAD (year)",
      value: String(Math.round(expenseSummary.yearTotal * 100) / 100),
      period: format(startOfYear(now), "yyyy"),
    },
    {
      metric: "Top expense category (month)",
      value: expenseSummary.topCategory.category ?? "—",
      period: format(startOfMonth(now), "yyyy-MM"),
    },
    {
      metric: "Snapshot generated at",
      value: now.toISOString(),
      period: "UTC",
    },
  ];

  return { kpis, daily, diagnoses };
}
