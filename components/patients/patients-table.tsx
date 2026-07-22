"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Eye, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GENDER_LABELS,
  INSURANCE_LABELS,
  type Gender,
  type InsuranceProvider,
} from "@/lib/constants";
import { formatRelative } from "@/lib/date";
import { matchesSearchQuery } from "@/lib/search";
import { initialsOf } from "@/lib/utils";

export type PatientRow = {
  id: string;
  name: string;
  age: string;
  gender: string;
  phoneNumber: string | null;
  cin: string | null;
  insuranceProvider: string;
  createdAt: string;
  visitCount: number;
};

export function PatientsTable({
  patients,
  canDelete,
}: {
  patients: PatientRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PatientRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return patients.filter((p) =>
      matchesSearchQuery([p.name, p.cin ?? "", p.phoneNumber ?? ""], query)
    );
  }, [patients, query]);

  function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    startTransition(async () => {
      const res = await fetch(`/api/patients/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Patient deleted");
        setPendingDelete(null);
        router.refresh();
      } else {
        toast.error("Unable to delete patient");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, CIN, or phone..."
            className="pl-9"
            aria-label="Search"
          />
        </div>
        <Button asChild>
          <Link href="/reception/patients/new">
            <Plus className="h-4 w-4" /> New patient
          </Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={
            query ? "No results" : "No patients registered yet"
          }
          description={
            query
              ? "Try another name, CIN, or phone number."
              : "Start by creating the first patient record."
          }
          action={
            !query ? (
              <Button asChild>
                <Link href="/reception/patients/new">
                  <Plus className="h-4 w-4" /> Create patient
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>CIN</TableHead>
                <TableHead>Insurance</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initialsOf(p.name)}
                      </div>
                      <div>
                        <Link
                          href={`/reception/patients/${p.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {p.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {GENDER_LABELS[p.gender as Gender] ?? p.gender} ·{" "}
                          {p.age}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.phoneNumber || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs uppercase">
                    {p.cin || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">
                      {INSURANCE_LABELS[
                        p.insuranceProvider as InsuranceProvider
                      ] ?? p.insuranceProvider}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{p.visitCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelative(p.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        aria-label="View patient"
                      >
                        <Link href={`/reception/patients/${p.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        aria-label="Edit"
                      >
                        <Link href={`/reception/patients/${p.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      {canDelete ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete"
                          onClick={() => setPendingDelete(p)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this patient?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `This permanently deletes ${pendingDelete.name}'s record and all related visits and consultations.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPendingDelete(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
