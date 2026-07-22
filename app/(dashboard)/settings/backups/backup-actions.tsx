"use client";

import { useState, useTransition } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type DriveResult =
  | { uploaded: { id: string; name: string; webViewLink?: string }[] }
  | { skipped: true; reason?: string };

type BackupSummary = {
  finishedAt: string;
  durationMs: number;
  artifacts: { filename: string; format: string; bytes: number }[];
  drive: DriveResult;
};

export function BackupActions({ lastRun }: { lastRun: BackupSummary | null }) {
  const [isPending, startTransition] = useTransition();
  const [drive, setDrive] = useState<DriveResult | null>(
    lastRun?.drive ?? null
  );

  function run() {
    startTransition(async () => {
      const t = toast.loading("Generating backup files...");
      try {
        const res = await fetch("/api/backup/run", { method: "POST" });
        const json = (await res.json()) as
          | (BackupSummary & { artifacts: BackupSummary["artifacts"] })
          | { error: string };
        if (!res.ok || "error" in json) {
          throw new Error(
            "error" in json ? json.error : "Unknown error"
          );
        }

        toast.success(
          `Backup generated — ${json.artifacts.length} file(s)`,
          { id: t }
        );
        setDrive(json.drive);
        if ("skipped" in json.drive && json.drive.skipped) {
          toast.warning(json.drive.reason ?? "Drive skipped.");
        } else if ("uploaded" in json.drive) {
          toast.success(
            `${json.drive.uploaded.length} file(s) uploaded to Drive`
          );
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Backup failed",
          { id: t }
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={run} disabled={isPending} size="lg">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CloudUpload className="h-4 w-4" />
        )}
        {isPending ? "Backup in progress..." : "Run backup now"}
      </Button>

      {drive ? (
        "skipped" in drive && drive.skipped ? (
          <p className="text-xs text-warning-foreground">
            Drive skipped: {drive.reason}
          </p>
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
  );
}
