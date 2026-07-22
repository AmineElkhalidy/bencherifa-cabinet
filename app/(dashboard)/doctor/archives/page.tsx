import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Archive, ChevronRight } from "lucide-react";

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
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/date";
import { matchesSearchQuery } from "@/lib/search";
import { initialsOf } from "@/lib/utils";

export const metadata = { title: "Archives" };

const PAGE_SIZE = 25;

const archiveItemInclude = {
  visit: { include: { patient: true } },
} satisfies Prisma.ConsultationInclude;

type ArchiveItem = Prisma.ConsultationGetPayload<{
  include: typeof archiveItemInclude;
}>;

function archiveSearchFields(consultation: ArchiveItem) {
  return [
    consultation.reasonForVisit,
    consultation.hps,
    consultation.rs,
    consultation.pe,
    consultation.vitals,
    consultation.eco,
    consultation.bloodWork,
    consultation.clinicalNotes,
    consultation.diagnosis,
    consultation.prescribedTreatment,
    consultation.dosageInstructions,
    consultation.allergiesConsidered,
    consultation.notes,
    consultation.visit.visitType,
    consultation.visit.patient.name,
    consultation.visit.patient.cin ?? "",
    consultation.visit.patient.phoneNumber ?? "",
    formatDateTime(consultation.createdAt),
    formatDateTime(consultation.followUpDate),
  ];
}

export default async function ArchivesPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireRole("DOCTOR");
  const { q, page } = await props.searchParams;
  const pageNumber = Math.max(1, Number(page) || 1);
  const queryString = q?.trim();

  let items: ArchiveItem[];
  let total: number;
  let totalPages: number;
  let currentPage: number;

  if (queryString) {
    const consultations = await prisma.consultation.findMany({
      orderBy: { createdAt: "desc" },
      include: archiveItemInclude,
    });
    const filtered = consultations.filter((consultation) =>
      matchesSearchQuery(archiveSearchFields(consultation), queryString)
    );

    total = filtered.length;
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(pageNumber, totalPages);
    items = filtered.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  } else {
    total = await prisma.consultation.count();
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(pageNumber, totalPages);
    items = await prisma.consultation.findMany({
      orderBy: { createdAt: "desc" },
      include: archiveItemInclude,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
  }

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="Clinical archives"
        description={`${total} consultation(s) registered in total. Search by patient, CIN, or diagnosis.`}
      />
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <form className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <CardTitle>Search archives</CardTitle>
                <CardDescription>
                  Full-text search across diagnosis, visit reason, and patient
                  record.
                </CardDescription>
                <input
                  type="text"
                  name="q"
                  defaultValue={queryString}
                  placeholder="Ex. gastritis, El Idrissi, AB123456..."
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button type="submit">Search</Button>
            </form>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Archive}
                  title={
                    queryString
                      ? "No results"
                      : "No archived consultations"
                  }
                  description={
                    queryString
                      ? "Try another name, CIN, diagnosis, or reason."
                      : "Completed consultations will appear here."
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Diagnostic</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(c.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initialsOf(c.visit.patient.name)}
                          </div>
                          <div>
                            <Link
                              href={`/reception/patients/${c.visit.patient.id}`}
                              className="font-medium hover:underline"
                            >
                              {c.visit.patient.name}
                            </Link>
                            <p className="text-xs text-muted-foreground font-mono uppercase">
                              {c.visit.patient.cin || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{c.visit.visitType}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {c.diagnosis || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.followUpDate
                          ? formatDateTime(c.followUpDate)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/doctor/consultations/${c.visit.id}`}>
                            Open <ChevronRight className="h-4 w-4" />
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

        {totalPages > 1 ? (
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              const params = new URLSearchParams();
              if (queryString) params.set("q", queryString);
              params.set("page", String(p));
              return (
                <Button
                  key={p}
                  asChild
                  size="sm"
                  variant={p === currentPage ? "default" : "outline"}
                >
                  <Link href={`/doctor/archives?${params.toString()}`}>
                    {p}
                  </Link>
                </Button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="muted">{items.length} shown</Badge>
          <Badge variant="muted">{total} total</Badge>
        </div>
      </div>
    </>
  );
}
