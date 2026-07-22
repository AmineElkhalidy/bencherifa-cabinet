import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Clock,
  Stethoscope,
  TrendingUp,
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
import { formatRelative, formatTime, todayRange } from "@/lib/date";
import { initialsOf } from "@/lib/utils";

export default async function DoctorDashboardPage() {
  const session = await requireRole("DOCTOR");
  const { from, to } = todayRange();

  const [waiting, completedToday, totalPatients, totalConsultations] =
    await Promise.all([
      prisma.visit.findMany({
        where: { status: "Pending", date: { gte: from, lte: to } },
        orderBy: { date: "asc" },
        include: { patient: true },
        take: 6,
      }),
      prisma.visit.count({
        where: { status: "Completed", date: { gte: from, lte: to } },
      }),
      prisma.patient.count(),
      prisma.consultation.count(),
    ]);

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="Tableau de bord clinique"
        description="Aperçu du jour : patients en attente, activité et accès rapide aux consultations."
        actions={
          <Button asChild size="lg">
            <Link href="/doctor/waiting-list">
              <ClipboardList className="h-4 w-4" /> Salle d'attente
            </Link>
          </Button>
        }
      />
      <div className="flex-1 space-y-8 overflow-auto p-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Patients en attente"
            value={waiting.length}
            hint="Aujourd'hui"
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Consultations terminées"
            value={completedToday}
            hint="Aujourd'hui"
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            label="Patients (total)"
            value={totalPatients}
            icon={Activity}
            tone="primary"
          />
          <StatCard
            label="Consultations (total)"
            value={totalConsultations}
            icon={TrendingUp}
            tone="default"
          />
        </section>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Prochains patients
              </CardTitle>
              <CardDescription>
                Cliquez sur un patient pour ouvrir son dossier de consultation.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/doctor/waiting-list">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {waiting.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CheckCircle2}
                  title="Aucun patient en attente"
                  description="Prenez un moment — la salle d'attente est vide pour l'instant."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Heure</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>En attente</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waiting.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">
                        {formatTime(v.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initialsOf(v.patient.name)}
                          </div>
                          <div>
                            <p className="font-medium">{v.patient.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {v.patient.phoneNumber || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{v.visitType}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(v.date)}
                      </TableCell>
                      <TableCell>
                        <VisitStatusBadge status={v.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm">
                          <Link href={`/doctor/consultations/${v.id}`}>
                            Démarrer
                          </Link>
                        </Button>
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
