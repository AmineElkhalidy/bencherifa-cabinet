import Link from "next/link";
import { Clock, Stethoscope } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  GENDER_LABELS,
  INSURANCE_LABELS,
  type Gender,
  type InsuranceProvider,
} from "@/lib/constants";
import { initialsOf } from "@/lib/utils";

export const metadata = { title: "Waiting list" };

export default async function WaitingListPage() {
  const session = await requireRole("DOCTOR");
  const { from, to } = todayRange();

  const visits = await prisma.visit.findMany({
    where: { status: "Pending", date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
    include: { patient: true },
  });

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="Waiting list"
        description={`${visits.length} patient(s) currently waiting.`}
      />
      <div className="flex-1 overflow-auto p-6">
        {visits.length === 0 ? (
          <Card>
            <CardContent className="p-10">
              <EmptyState
                icon={Clock}
                title="No patients waiting"
                description="All of today's patients have been seen."
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Patients in the waiting room
              </CardTitle>
              <CardDescription>
                Ordered by arrival time. Allergies and CIN are visible to
                prepare the consultation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Allergies</TableHead>
                    <TableHead>Insurance</TableHead>
                    <TableHead>Waiting</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((v) => (
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
                            <Link
                              href={`/reception/patients/${v.patient.id}`}
                              className="font-medium hover:underline"
                            >
                              {v.patient.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {[v.patient.phoneNumber, v.patient.cin || "—"]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {GENDER_LABELS[v.patient.gender as Gender] ??
                          v.patient.gender}
                        {" · "}
                        {v.patient.age}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {v.patient.allergies?.trim() || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="muted">
                          {INSURANCE_LABELS[
                            v.patient.insuranceProvider as InsuranceProvider
                          ] ?? v.patient.insuranceProvider}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(v.date)}
                      </TableCell>
                      <TableCell>
                        <VisitStatusBadge status={v.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm">
                          <Link href={`/doctor/consultations/${v.id}`}>
                            Start consultation
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
