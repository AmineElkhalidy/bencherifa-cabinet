import "server-only";

import { buildBackupArtifacts, type BackupArtifactFormat } from "./exporter";
import { uploadArtifactsToDrive } from "./google-drive";

export type BackupRunSummary = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  artifacts: { filename: string; bytes: number; format: BackupArtifactFormat }[];
  drive:
    | { uploaded: { id: string; name: string; webViewLink?: string }[] }
    | { skipped: true; reason?: string };
};

let lastRun: BackupRunSummary | null = null;

export async function runBackup(): Promise<BackupRunSummary> {
  const startedAt = new Date();
  const artifacts = await buildBackupArtifacts(startedAt);
  const drive = await uploadArtifactsToDrive(artifacts);
  const finishedAt = new Date();

  const summary: BackupRunSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    artifacts: artifacts.map((a) => ({
      filename: a.filename,
      bytes: a.bytes,
      format: a.format,
    })),
    drive: drive.skipped
      ? { skipped: true, reason: drive.reason }
      : { uploaded: drive.uploaded },
  };

  lastRun = summary;
  return summary;
}

export function getLastBackupRun() {
  return lastRun;
}
