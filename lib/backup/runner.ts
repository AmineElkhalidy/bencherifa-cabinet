import "server-only";

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { logger } from "@/lib/logger";
import { backupDir } from "@/lib/storage";
import { buildBackupArtifacts, type BackupArtifactFormat } from "./exporter";
import { uploadArtifactsToDrive } from "./google-drive";

export type BackupRunSummary = {
  slug: string;
  status: "success" | "failed";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  artifacts: {
    filename: string;
    bytes: number;
    format: BackupArtifactFormat;
    sha256: string;
  }[];
  drive:
    | {
        uploaded: { id: string; name: string; webViewLink?: string }[];
        error?: string;
      }
    | { skipped: true; reason?: string };
  error?: string;
};

export type AvailableBackupPoint = {
  slug: string;
  createdAt: string;
  dbFilename: string;
  dbBytes: number;
  uploadsZipFilename: string | null;
  xlsxFilename: string | null;
  csvZipFilename: string | null;
  sha256?: string;
};

const HISTORY_FILENAME = "backup-history.json";
const MAX_HISTORY_ENTRIES = 50;

let isBackupRunning = false;

function getHistoryFilePath(): string {
  return path.join(backupDir(), HISTORY_FILENAME);
}

export function getBackupHistory(): BackupRunSummary[] {
  const historyPath = getHistoryFilePath();
  if (!existsSync(historyPath)) {
    return [];
  }
  try {
    const raw = readFileSync(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as BackupRunSummary[];
    }
    return [];
  } catch (err) {
    logger.warn("backup", "Failed to read backup history file", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

async function appendBackupHistory(entry: BackupRunSummary): Promise<void> {
  try {
    const current = getBackupHistory();
    const updated = [entry, ...current].slice(0, MAX_HISTORY_ENTRIES);
    await writeFile(
      getHistoryFilePath(),
      JSON.stringify(updated, null, 2),
      "utf8"
    );
  } catch (err) {
    logger.error("backup", "Failed to persist backup history", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Retains the N most recent backup sets (`cabinet-<slug>*`) in `backupDir()`
 * and removes older backup artifacts to prevent unbounded disk usage.
 */
async function enforceBackupRetention(): Promise<void> {
  const rawLimit = Number(process.env.BACKUP_RETENTION_COUNT ?? "14");
  const retentionCount =
    Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : 14;

  try {
    const dir = backupDir();
    const entries = readdirSync(dir);
    const dbFiles = entries
      .filter((name) =>
        /^cabinet-(\d{8}T\d{6}|\d{4}-\d{2}-\d{2}T[\d-]+Z)\.db$/.test(name)
      )
      .sort()
      .reverse(); // Newest slug first

    if (dbFiles.length <= retentionCount) {
      return;
    }

    const slugsToRemove = dbFiles
      .slice(retentionCount)
      .map((name) => name.replace(/^cabinet-/, "").replace(/\.db$/, ""));

    for (const slug of slugsToRemove) {
      const prefix = `cabinet-${slug}`;
      const matchingFiles = entries.filter((name) => name.startsWith(prefix));
      for (const file of matchingFiles) {
        await rm(path.join(dir, file), { force: true }).catch(() => {});
      }
      logger.info("backup", "Pruned expired backup set per retention policy", {
        slug,
      });
    }
  } catch (err) {
    logger.warn("backup", "Backup retention cleanup encountered an error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function runBackup(): Promise<BackupRunSummary> {
  if (isBackupRunning) {
    throw new Error("A backup operation is already in progress.");
  }

  isBackupRunning = true;
  const startedAt = new Date();

  try {
    const { slug, artifacts } = await buildBackupArtifacts(startedAt);
    const drive = await uploadArtifactsToDrive(artifacts);
    const finishedAt = new Date();

    const summary: BackupRunSummary = {
      slug,
      status: "success",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      artifacts: artifacts.map((a) => ({
        filename: a.filename,
        bytes: a.bytes,
        format: a.format,
        sha256: a.sha256,
      })),
      drive: drive.skipped
        ? { skipped: true, reason: drive.reason }
        : { uploaded: drive.uploaded, error: drive.error },
    };

    await appendBackupHistory(summary);
    await enforceBackupRetention();

    logger.info("backup", "Backup completed successfully", {
      slug,
      durationMs: summary.durationMs,
      artifactCount: summary.artifacts.length,
    });

    return summary;
  } catch (err) {
    const finishedAt = new Date();
    const errorMessage = err instanceof Error ? err.message : "Backup failed";
    const failedSummary: BackupRunSummary = {
      slug: startedAt.toISOString().replace(/[:.]/g, "-"),
      status: "failed",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      artifacts: [],
      drive: { skipped: true, reason: "Skipped due to backup failure" },
      error: errorMessage,
    };

    await appendBackupHistory(failedSummary);
    logger.error("backup", "Backup execution failed", { error: errorMessage });
    throw err;
  } finally {
    isBackupRunning = false;
  }
}

export function getLastBackupRun(): BackupRunSummary | null {
  const history = getBackupHistory();
  return history[0] ?? null;
}

export function listAvailableBackups(): AvailableBackupPoint[] {
  const dir = backupDir();
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir);
  const entrySet = new Set(entries);
  const history = getBackupHistory();
  const shaByFilename = new Map<string, string>();
  for (const run of history) {
    for (const art of run.artifacts) {
      if (art.sha256) {
        shaByFilename.set(art.filename, art.sha256);
      }
    }
  }

  const dbFiles = entries
    .filter((name) =>
      /^cabinet-(\d{8}T\d{6}|\d{4}-\d{2}-\d{2}T[\d-]+Z)\.db$/.test(name)
    )
    .sort()
    .reverse();

  return dbFiles.map((dbFilename) => {
    const slug = dbFilename.replace(/^cabinet-/, "").replace(/\.db$/, "");
    const fullDbPath = path.join(dir, dbFilename);
    const stat = statSync(fullDbPath);
    const uploadsZip = `cabinet-${slug}-uploads.zip`;
    const xlsx = `cabinet-${slug}.xlsx`;
    const csvZip = `cabinet-${slug}-csv.zip`;

    return {
      slug,
      createdAt: stat.mtime.toISOString(),
      dbFilename,
      dbBytes: stat.size,
      uploadsZipFilename: entrySet.has(uploadsZip) ? uploadsZip : null,
      xlsxFilename: entrySet.has(xlsx) ? xlsx : null,
      csvZipFilename: entrySet.has(csvZip) ? csvZip : null,
      sha256: shaByFilename.get(dbFilename),
    };
  });
}
