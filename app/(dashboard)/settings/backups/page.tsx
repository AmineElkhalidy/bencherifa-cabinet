import {
  CalendarClock,
  CloudUpload,
  Database,
  ShieldCheck,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/rbac";
import {
  getLastBackupRun,
  listAvailableBackups,
} from "@/lib/backup/runner";
import { backupDir, uploadDir } from "@/lib/storage";
import { formatDateTime } from "@/lib/date";

import { BackupActions } from "./backup-actions";

export const metadata = { title: "Backups" };

export default async function BackupSettingsPage() {
  const session = await requireRole("DOCTOR");
  const lastRun = getLastBackupRun();
  const availableBackups = listAvailableBackups();

  const driveConfigured =
    !!process.env.GOOGLE_DRIVE_CLIENT_EMAIL &&
    !!process.env.GOOGLE_DRIVE_PRIVATE_KEY &&
    !!process.env.GOOGLE_DRIVE_FOLDER_ID;

  const cronEnabled = process.env.ENABLE_BACKUP_CRON === "1";

  return (
    <>
      <Header
        username={session.username}
        role={session.role}
        title="Backups & Disaster Recovery"
        description="Full nightly export: SQLite snapshot (VACUUM INTO), spreadsheets, analytics snapshot, uploaded documents, integrity verification, and restore."
      />
      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard
            icon={CloudUpload}
            title="Google Drive"
            badge={
              driveConfigured ? (
                <Badge variant="success">Configured</Badge>
              ) : (
                <Badge variant="warning">Not configured</Badge>
              )
            }
            description={
              driveConfigured
                ? "The service account is ready to upload to the configured folder."
                : "Set GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID to enable automatic uploads."
            }
          />
          <StatusCard
            icon={CalendarClock}
            title="Cron & Retention"
            badge={
              cronEnabled ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="muted">Disabled</Badge>
              )
            }
            description={
              cronEnabled
                ? `Expression: ${process.env.BACKUP_CRON ?? "0 0 * * *"} (${process.env.TZ ?? "default time zone"}) · Retention: ${process.env.BACKUP_RETENTION_COUNT ?? "14"} sets`
                : "Enable ENABLE_BACKUP_CRON=1 in .env to schedule automatic exports."
            }
          />
          <StatusCard
            icon={Database}
            title="Stockage"
            description={
              <>
                <span className="block">
                  Backups: <code>{backupDir()}</code>
                </span>
                <span className="block">
                  Documents : <code>{uploadDir()}</code>
                </span>
              </>
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Backup &
              Restoration Control Center
            </CardTitle>
            <CardDescription>
              Exports all clinic data (patients, visits, consultations, expenses,
              prescriptions, documents metadata, users, analytics), creates a
              consistent SQLite snapshot, zips medical uploads with SHA-256
              integrity hashes, and uploads every artifact to Google Drive when
              configured.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BackupActions
              lastRun={
                lastRun
                  ? {
                      finishedAt: lastRun.finishedAt,
                      durationMs: lastRun.durationMs,
                      artifacts: lastRun.artifacts,
                      drive: lastRun.drive,
                    }
                  : null
              }
              availableBackups={availableBackups}
            />
            {lastRun ? (
              <div className="mt-6 space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Last export — {formatDateTime(lastRun.finishedAt)} (
                  {lastRun.status})
                </p>
                {lastRun.error ? (
                  <p className="text-xs text-destructive">{lastRun.error}</p>
                ) : null}
                <ul className="space-y-1 font-mono text-xs">
                  {lastRun.artifacts.map((a) => (
                    <li key={a.filename}>
                      <span className="text-primary">{a.format}</span> ·{" "}
                      {a.filename} ({(a.bytes / 1024).toFixed(1)} KB)
                      {a.sha256 ? (
                        <span className="ml-2 text-muted-foreground">
                          [sha256: {a.sha256.slice(0, 12)}…]
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatusCard({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        {badge}
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
