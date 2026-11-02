"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CloudUpload,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AvailableBackupPoint } from "@/lib/backup/runner";

type DriveResult =
  | {
      uploaded: { id: string; name: string; webViewLink?: string }[];
      error?: string;
    }
  | { skipped: true; reason?: string };

type BackupSummary = {
  finishedAt: string;
  durationMs: number;
  artifacts: {
    filename: string;
    format: string;
    bytes: number;
    sha256?: string;
  }[];
  drive: DriveResult;
};

type InspectionState = {
  valid: boolean;
  integrityCheck: string;
  foreignKeyViolations: number;
  counts: {
    users: number;
    patients: number;
    visits: number;
    consultations: number;
    prescriptions: number;
    expenses: number;
    documents: number;
  };
  error?: string;
};

export function BackupActions({
  lastRun,
  availableBackups = [],
}: {
  lastRun: BackupSummary | null;
  availableBackups?: AvailableBackupPoint[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drive, setDrive] = useState<DriveResult | null>(
    lastRun?.drive ?? null
  );
  const [inspections, setInspections] = useState<
    Record<string, InspectionState>
  >({});

  function run() {
    startTransition(async () => {
      const t = toast.loading("Generating backup files...");
      try {
        const res = await fetch("/api/backup/run", { method: "POST" });
        const json = (await res.json()) as
          | (BackupSummary & { artifacts: BackupSummary["artifacts"] })
          | { error: string };
        if (!res.ok || "error" in json) {
          throw new Error("error" in json ? json.error : "Unknown error");
        }

        toast.success(`Backup generated — ${json.artifacts.length} file(s)`, {
          id: t,
        });
        setDrive(json.drive);
        if ("skipped" in json.drive && json.drive.skipped) {
          toast.warning(json.drive.reason ?? "Drive skipped.");
        } else if ("error" in json.drive && json.drive.error) {
          toast.error(json.drive.error);
        } else if ("uploaded" in json.drive) {
          toast.success(
            `${json.drive.uploaded.length} file(s) uploaded to Drive`
          );
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Backup failed", {
          id: t,
        });
      }
    });
  }

  function verifyPoint(slug: string) {
    startTransition(async () => {
      const t = toast.loading(`Verifying backup ${slug}...`);
      try {
        const res = await fetch("/api/backup/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, mode: "verify" }),
        });
        const json = (await res.json()) as
          | { mode: "verify"; inspection: InspectionState }
          | { error: string };
        if (!res.ok || "error" in json) {
          throw new Error("error" in json ? json.error : "Verification failed");
        }
        setInspections((prev) => ({ ...prev, [slug]: json.inspection }));
        if (json.inspection.valid) {
          toast.success(
            `Integrity verified (${json.inspection.counts.patients} patients, ${json.inspection.counts.consultations} consultations)`,
            { id: t }
          );
        } else {
          toast.error(
            `Backup failed integrity check: ${json.inspection.error ?? "invalid"}`,
            { id: t }
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Verification failed", {
          id: t,
        });
      }
    });
  }

  function restorePoint(slug: string) {
    const confirmed = window.confirm(
      `Restore database and uploaded files from backup "${slug}"?\n\nA pre-restore safety snapshot of the current database will be created automatically before restoring.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const t = toast.loading(`Restoring clinic data from ${slug}...`);
      try {
        const res = await fetch("/api/backup/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, mode: "restore" }),
        });
        const json = (await res.json()) as
          | {
              mode: "restore";
              result: {
                restoredFilesCount: number;
                inspection: InspectionState;
              };
            }
          | { error: string };
        if (!res.ok || "error" in json) {
          throw new Error("error" in json ? json.error : "Restore failed");
        }
        toast.success(
          `Restore complete (${json.result.inspection.counts.patients} patients, ${json.result.restoredFilesCount} files restored).`,
          { id: t }
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Restore failed", {
          id: t,
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={isPending} size="lg">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CloudUpload className="h-4 w-4" />
          )}
          {isPending ? "Operation in progress..." : "Run backup now"}
        </Button>

        {drive ? (
          "skipped" in drive && drive.skipped ? (
            <p className="text-xs text-warning-foreground">
              Drive skipped: {drive.reason}
            </p>
          ) : "error" in drive && drive.error ? (
            <p className="text-xs text-destructive">{drive.error}</p>
          ) : "uploaded" in drive && drive.uploaded.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {drive.uploaded.map((u) =>
                u.webViewLink ? (
                  <li key={u.id}>
                    <a
                      href={u.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {u.name}
                    </a>
                  </li>
                ) : (
                  <li key={u.id} className="text-muted-foreground">
                    {u.name}
                  </li>
                )
              )}
            </ul>
          ) : null
        ) : null}
      </div>

      {availableBackups.length > 0 ? (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold">
            Available Restore Points ({availableBackups.length})
          </h3>
          <div className="divide-y divide-border rounded-lg border border-border">
            {availableBackups.slice(0, 10).map((point) => {
              const info = inspections[point.slug];
              return (
                <div
                  key={point.slug}
                  className="flex flex-col gap-2 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 font-mono font-medium">
                      <span>{point.dbFilename}</span>
                      <Badge variant="muted">
                        {(point.dbBytes / 1024).toFixed(1)} KB
                      </Badge>
                      {point.uploadsZipFilename ? (
                        <Badge variant="outline">+ uploads.zip</Badge>
                      ) : null}
                      {info ? (
                        info.valid ? (
                          <Badge variant="success">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Verified OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Invalid</Badge>
                        )
                      ) : null}
                    </div>
                    {point.sha256 ? (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        SHA-256: {point.sha256.slice(0, 24)}…
                      </p>
                    ) : null}
                    {info?.valid ? (
                      <p className="text-muted-foreground">
                        Patients: {info.counts.patients} · Visits:{" "}
                        {info.counts.visits} · Consultations:{" "}
                        {info.counts.consultations} · Prescriptions:{" "}
                        {info.counts.prescriptions} · Documents:{" "}
                        {info.counts.documents}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => verifyPoint(point.slug)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verify
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isPending}
                      onClick={() => restorePoint(point.slug)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
