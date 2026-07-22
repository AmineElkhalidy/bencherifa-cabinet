import Link from "next/link";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfWeek,
  format,
  isAfter,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Activity,
  CalendarRange,
  ClipboardList,
  Filter,
  RotateCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatMAD } from "@/lib/utils";

export const metadata = { title: "Analytics" };

type GroupBy = "day" | "week" | "month" | "year";

type AnalyticsSearchParams = {
  from?: string | string[] | undefined;
  to?: string | string[] | undefined;
  groupBy?: string | string[] | undefined;
};

const GROUP_BY_OPTIONS: Record<
  GroupBy,
  { label: string; activityTitle: string; description: string }
> = {
  day: {
    label: "Day",
    activityTitle: "Daily activity",
    description: "See daily activity trends over a selected date range.",
  },
  week: {
    label: "Week",
    activityTitle: "Weekly activity",
    description: "Group visits by week to spot broader operational trends.",
  },
  month: {
    label: "Month",
    activityTitle: "Monthly activity",
    description: "Follow monthly performance and seasonality more easily.",
  },
  year: {
    label: "Year",
    activityTitle: "Yearly activity",
    description: "Review long-term yearly growth and performance.",
  },
};

export default async function AnalyticsPage(props: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const session = await requireRole("DOCTOR");
  const params = await props.searchParams;

  const today = startOfDay(new Date());
  const groupBy = parseGroupBy(readSearchParam(params.groupBy));
  const defaults = getDefaultDateRange(groupBy, today);
  let from = parseDateInput(readSearchParam(params.from)) ?? defaults.from;
  let to = parseDateInput(readSearchParam(params.to)) ?? defaults.to;

  if (isAfter(from, to)) {
    [from, to] = [to, from];
  }

  const rangeLabel = `${format(from, "dd MMM yyyy", { locale: enUS })} - ${format(
    to,
    "dd MMM yyyy",
    { locale: enUS }
  )}`;
  const rangeEnd = endOfDay(to);

  const [visits, topDiagnoses] = await Promise.all([
    prisma.visit.findMany({
      where: { date: { gte: from, lte: rangeEnd } },
      select: { date: true, status: true, price: true },
    }),
    prisma.consultation.groupBy({
      by: ["diagnosis"],
      _count: { _all: true },
      where: {
        diagnosis: { not: "" },
        date: { gte: from, lte: rangeEnd },
      },
      orderBy: { _count: { diagnosis: "desc" } },
      take: 5,
    }),
  ]);

  const completed = visits.filter((v) => v.status === "Completed");
  const revenue = visits.reduce((s, v) => s + v.price, 0);
  const completionRate = visits.length
    ? Math.round((completed.length / visits.length) * 100)
    : 0;
  const series = buildSeries(visits, from, to, groupBy);
  const maxCount = Math.max(1, ...series.map((s) => s.count));
  const totalDiagnoses = topDiagnoses.reduce((s, d) => s + d._count._all, 0);

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="Analytics"
        description={`Performance indicators filtered by date range and grouped by ${GROUP_BY_OPTIONS[groupBy].label.toLowerCase()}.`}
      />
      <div className="flex-1 space-y-8 overflow-auto p-6">
        <Card className="border-primary/10 bg-linear-to-r from-primary/5 via-card to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" />
              Analytics filters
            </CardTitle>
            <CardDescription>
              {GROUP_BY_OPTIONS[groupBy].description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              method="get"
              className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto_auto]"
            >
              <div className="space-y-2">
                <Label htmlFor="from">From</Label>
                <Input
                  id="from"
                  name="from"
                  type="date"
                  defaultValue={format(from, "yyyy-MM-dd")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  name="to"
                  type="date"
                  defaultValue={format(to, "yyyy-MM-dd")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupBy">Group by</Label>
                <select
                  id="groupBy"
                  name="groupBy"
                  defaultValue={groupBy}
                  aria-label="Group analytics by period"
                  title="Group analytics by period"
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
                >
                  {(
                    Object.entries(GROUP_BY_OPTIONS) as Array<
                      [GroupBy, (typeof GROUP_BY_OPTIONS)[GroupBy]]
                    >
                  ).map(([value, option]) => (
                    <option key={value} value={value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full lg:w-auto">
                  <Filter className="h-4 w-4" />
                  Apply
                </Button>
              </div>
              <div className="flex items-end">
                <Button asChild variant="ghost" className="w-full lg:w-auto">
                  <Link href="/doctor/analytics">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Link>
                </Button>
              </div>
            </form>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-3 py-1">{rangeLabel}</span>
              <span className="rounded-full bg-muted px-3 py-1">
                Grouped by {GROUP_BY_OPTIONS[groupBy].label.toLowerCase()}
              </span>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Visits in range"
            value={visits.length}
            hint={rangeLabel}
            icon={ClipboardList}
            tone="primary"
          />
          <StatCard
            label="Completed consultations"
            value={completed.length}
            hint={`${completionRate}% completion rate`}
            icon={Activity}
            tone="success"
          />
          <StatCard
            label="Visit revenue"
            value={formatMAD(revenue)}
            hint={`Visits registered from ${rangeLabel}`}
            icon={Wallet}
            tone="default"
          />
          <StatCard
            label="Top diagnostic"
            value={topDiagnoses[0]?.diagnosis || "—"}
            hint={
              topDiagnoses[0]
                ? `${topDiagnoses[0]._count._all} cases in selected range`
                : "No diagnosis yet"
            }
            icon={TrendingUp}
            tone="warning"
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{GROUP_BY_OPTIONS[groupBy].activityTitle}</CardTitle>
            <CardDescription>
              Visits and revenue grouped by {GROUP_BY_OPTIONS[groupBy].label.toLowerCase()} from{" "}
              {rangeLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 overflow-x-auto pb-2">
              {series.map((s) => (
                <div
                  key={s.date}
                  className="group relative flex min-w-[46px] flex-col items-center"
                  title={`${s.title}: ${s.count} visit(s) • ${formatMAD(s.revenue)}`}
                >
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all group-hover:bg-primary"
                    style={{
                      height: `${(s.count / maxCount) * 140 + 4}px`,
                    }}
                  />
                  <span className="mt-2 select-none text-[10px] text-muted-foreground">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 diagnoses</CardTitle>
            <CardDescription>
              Most frequent diagnoses recorded from {rangeLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topDiagnoses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not enough data yet.
              </p>
            ) : (
              topDiagnoses.map((d) => {
                const pct = totalDiagnoses
                  ? Math.round((d._count._all / totalDiagnoses) * 100)
                  : 0;
                return (
                  <div key={d.diagnosis} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{d.diagnosis || "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {d._count._all} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseGroupBy(value: string | undefined): GroupBy {
  if (value === "week" || value === "month" || value === "year") {
    return value;
  }
  return "day";
}

function parseDateInput(value: string | undefined) {
  if (!value) return null;
  const parsed = startOfDay(new Date(`${value}T00:00:00`));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDefaultDateRange(groupBy: GroupBy, today: Date) {
  switch (groupBy) {
    case "week":
      return {
        from: startOfWeek(subWeeks(today, 11), { weekStartsOn: 1 }),
        to: today,
      };
    case "month":
      return {
        from: startOfMonth(subMonths(today, 11)),
        to: today,
      };
    case "year":
      return {
        from: startOfYear(subYears(today, 4)),
        to: today,
      };
    case "day":
    default:
      return {
        from: subDays(today, 29),
        to: today,
      };
  }
}

function startOfBucket(date: Date, groupBy: GroupBy) {
  switch (groupBy) {
    case "week":
      return startOfWeek(date, { weekStartsOn: 1 });
    case "month":
      return startOfMonth(date);
    case "year":
      return startOfYear(date);
    case "day":
    default:
      return startOfDay(date);
  }
}

function addBucket(date: Date, groupBy: GroupBy) {
  switch (groupBy) {
    case "week":
      return addWeeks(date, 1);
    case "month":
      return addMonths(date, 1);
    case "year":
      return addYears(date, 1);
    case "day":
    default:
      return addDays(date, 1);
  }
}

function formatBucketLabel(date: Date, groupBy: GroupBy) {
  switch (groupBy) {
    case "week":
      return format(date, "dd MMM", { locale: enUS });
    case "month":
      return format(date, "MMM yy", { locale: enUS });
    case "year":
      return format(date, "yyyy", { locale: enUS });
    case "day":
    default:
      return format(date, "dd MMM", { locale: enUS });
  }
}

function formatBucketTitle(date: Date, groupBy: GroupBy) {
  switch (groupBy) {
    case "week":
      return `${format(date, "dd MMM yyyy", { locale: enUS })} - ${format(
        endOfWeek(date, { weekStartsOn: 1 }),
        "dd MMM yyyy",
        { locale: enUS }
      )}`;
    case "month":
      return format(date, "MMMM yyyy", { locale: enUS });
    case "year":
      return format(date, "yyyy", { locale: enUS });
    case "day":
    default:
      return format(date, "dd MMM yyyy", { locale: enUS });
  }
}

function buildSeries(
  visits: Array<{ date: Date; status: string; price: number }>,
  from: Date,
  to: Date,
  groupBy: GroupBy
) {
  const buckets = new Map<
    string,
    {
      date: string;
      label: string;
      title: string;
      count: number;
      revenue: number;
    }
  >();

  let cursor = startOfBucket(from, groupBy);
  const lastBucket = startOfBucket(to, groupBy);

  while (!isAfter(cursor, lastBucket)) {
    const key = format(cursor, "yyyy-MM-dd");
    buckets.set(key, {
      date: key,
      label: formatBucketLabel(cursor, groupBy),
      title: formatBucketTitle(cursor, groupBy),
      count: 0,
      revenue: 0,
    });
    cursor = addBucket(cursor, groupBy);
  }

  for (const visit of visits) {
    const bucketStart = startOfBucket(visit.date, groupBy);
    const key = format(bucketStart, "yyyy-MM-dd");
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.revenue += visit.price;
  }

  return Array.from(buckets.values()).map((bucket) => ({
    ...bucket,
    revenue: Math.round(bucket.revenue * 100) / 100,
  }));
}
