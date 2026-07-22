import Link from "next/link";
import {
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Plus,
  Users,
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
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VisitStatusBadge } from "@/components/visits/visit-status-badge";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatTime, todayRange } from "@/lib/date";
import { formatMAD, initialsOf } from "@/lib/utils";

export default async function ReceptionDashboardPage() {
  const session = await requireRole("RECEPTIONIST", "DOCTOR");
  const { from, to } = todayRange();

  const [patientCount, todayVisits, pendingCount, completedToday] =
    await Promise.all([
      prisma.patient.count(),
      prisma.visit.findMany({
        where: { date: { gte: from, lte: to } },
        orderBy: { date: "asc" },
        include: { patient: true },
      }),
      prisma.visit.count({
        where: { status: "Pending", date: { gte: from, lte: to } },
      }),
      prisma.visit.count({
        where: { status: "Completed", date: { gte: from, lte: to } },
      }),
    ]);

  const revenueToday = todayVisits.reduce((sum, v) => sum + v.price, 0);

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="Prêt à accueillir vos patients ?"
        description="Aperçu de la journée, patients en attente et actions rapides."
        actions={
          <Button asChild size="lg">
            <Link href="/reception/visits/new">
              <CalendarPlus className="h-4 w-4" /> Nouvelle visite
            </Link>
          </Button>
        }
      />

      <div className="flex-1 space-y-8 overflow-auto p-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Patients inscrits"
            value={patientCount}
            hint="Toutes les inscriptions"
            icon={Users}
            tone="primary"
          />
          <StatCard
            label="Visites aujourd'hui"
            value={todayVisits.length}
            hint={`${completedToday} terminées · ${pendingCount} en attente`}
            icon={ClipboardList}
            tone="default"
          />
          <StatCard
            label="En salle d'attente"
            value={pendingCount}
            hint="Visible par le médecin en temps réel"
            icon={Clock}
            tone="warning"
          />
          {session.role === "DOCTOR" && (
            <StatCard
              label="Revenu d'aujourd'hui"
              value={formatMAD(revenueToday)}
              hint="Toutes les visites enregistrées aujourd'hui"
              icon={ClipboardCheck}
              tone="success"
            />
          )}
        </section>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Visites d'aujourd'hui</CardTitle>
              <CardDescription>
                Toutes les visites créées aujourd'hui, triées par heure d'arrivée.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/reception/visits/new">
                <Plus className="h-4 w-4" /> Ajouter
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {todayVisits.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Clock}
                  title="Aucune visite enregistrée aujourd'hui"
                  description="Cliquez sur 'Nouvelle visite' pour ajouter le premier patient à la liste d'attente."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Heure</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayVisits.map((v, index) => (
                    <TableRow key={v.id}>
                      <TableCell className="text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatTime(v.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {initialsOf(v.patient.name)}
                          </div>
                          <div>
                            <Link
                              href={`/reception/patients/${v.patient.id}`}
                              className="font-medium hover:underline"
                            >
                              {v.patient.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {v.patient.phoneNumber || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{v.visitType}</TableCell>
                      <TableCell className="font-medium">
                        {formatMAD(v.price)}
                      </TableCell>
                      <TableCell>
                        <VisitStatusBadge status={v.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
