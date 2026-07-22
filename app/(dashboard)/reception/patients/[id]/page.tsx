import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CalendarPlus,
  IdCard,
  Pencil,
  Phone,
  Scissors,
  ShieldCheck,
  Stethoscope,
  Syringe,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
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
import { formatDateTime } from "@/lib/date";
import {
  GENDER_LABELS,
  INSURANCE_LABELS,
  type Gender,
  type InsuranceProvider,
} from "@/lib/constants";
import { formatMAD, initialsOf } from "@/lib/utils";

export default async function PatientDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await requireRole("RECEPTIONIST", "DOCTOR");

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      visits: {
        orderBy: { date: "desc" },
        include: {
          consultation: { select: { id: true, diagnosis: true } },
        },
      },
    },
  });

  if (!patient) notFound();

  const isDoctor = session.role === "DOCTOR";

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title={patient.name}
        description={`${GENDER_LABELS[patient.gender as Gender] ?? patient.gender} · ${patient.age}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/reception/patients/${patient.id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/reception/visits/new?patientId=${patient.id}`}>
                <CalendarPlus className="h-4 w-4" /> New visit
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader className="items-center text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                {initialsOf(patient.name)}
              </div>
              <CardTitle className="mt-2">{patient.name}</CardTitle>
              <CardDescription>
                Registered on {formatDateTime(patient.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow
                icon={Phone}
                label="Phone"
                value={patient.phoneNumber || "—"}
              />
              <InfoRow icon={IdCard} label="CIN" value={patient.cin || "—"} mono />
              <InfoRow
                icon={ShieldCheck}
                label="Insurance"
                value={
                  <Badge variant="muted">
                    {INSURANCE_LABELS[
                      patient.insuranceProvider as InsuranceProvider
                    ] ?? patient.insuranceProvider}
                  </Badge>
                }
              />
            </CardContent>
          </Card>

          {isDoctor ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Medical history
                </CardTitle>
                <CardDescription>
                  Visible only to the doctor during the consultation.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <HistoryBlock
                  icon={Scissors}
                  title="Surgical"
                  value={patient.surgicalHistory}
                />
                <HistoryBlock
                  icon={Syringe}
                  title="Allergies"
                  value={patient.allergies}
                />
                <HistoryBlock
                  icon={AlertTriangle}
                  title="Contraindications"
                  value={patient.contraindications}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Medical history</CardTitle>
                <CardDescription>
                  Reserved for the doctor. Reception cannot view detailed
                  clinical notes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={Stethoscope}
                  title="Locked section"
                  description="Ask the doctor to share this information if needed."
                />
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Visit history</CardTitle>
            <CardDescription>
              {patient.visits.length} visit(s) registered in total.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {patient.visits.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CalendarPlus}
                  title="No visits for this patient"
                  description="Create the first visit to place this patient on the doctor's waiting list."
                  action={
                    <Button asChild>
                      <Link
                        href={`/reception/visits/new?patientId=${patient.id}`}
                      >
                        <CalendarPlus className="h-4 w-4" /> New visit
                      </Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    {isDoctor ? <TableHead>Diagnostic</TableHead> : null}
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patient.visits.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(v.date)}
                      </TableCell>
                      <TableCell>{v.visitType}</TableCell>
                      <TableCell>{formatMAD(v.price)}</TableCell>
                      <TableCell>
                        <VisitStatusBadge status={v.status} />
                      </TableCell>
                      {isDoctor ? (
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {v.consultation?.diagnosis || "—"}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        {isDoctor ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link
                              href={`/doctor/consultations/${v.id}`}
                            >
                              {v.status === "Pending"
                                ? "Start"
                                : "View"}
                            </Link>
                          </Button>
                        ) : null}
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

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`text-sm font-medium text-foreground ${mono ? "font-mono uppercase" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function HistoryBlock({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-line">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}
