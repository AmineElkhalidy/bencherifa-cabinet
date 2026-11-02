import "server-only";

import { createHash } from "node:crypto";
import { existsSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import JSZip from "jszip";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { backupDir, resolveSqliteFile, uploadDir } from "@/lib/storage";

export type BackupInspectionResult = {
  valid: boolean;
  dbPath: string;
  bytes: number;
  sha256: string;
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

export type RestoreOptions = {
  dbBackupPath: string;
  uploadsZipPath?: string | null;
  targetDbPath?: string;
  targetUploadsDir?: string;
  createPreRestoreSnapshot?: boolean;
};

export type RestoreResult = {
  restoredDbPath: string;
  preRestoreSnapshotPath: string | null;
  restoredFilesCount: number;
  inspection: BackupInspectionResult;
};

const SQLITE_MAGIC_HEADER = "SQLite format 3\0";

async function computeFileSha256(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

function hasValidSqliteHeader(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  if (stat.size < 100) return false;

  const fd = openSync(filePath, "r");
  try {
    const headerBuf = Buffer.alloc(16);
    const bytesRead = readSync(fd, headerBuf, 0, 16, 0);
    if (bytesRead < 16) return false;
    return headerBuf.toString("utf8") === SQLITE_MAGIC_HEADER;
  } finally {
    closeSync(fd);
  }
}

/**
 * Inspects a SQLite backup file for binary header validity, PRAGMA integrity_check,
 * PRAGMA foreign_key_check, and table row counts without modifying the database.
 */
export async function inspectBackupDatabase(
  dbBackupPath: string
): Promise<BackupInspectionResult> {
  const resolvedPath = path.resolve(dbBackupPath);
  if (!existsSync(resolvedPath)) {
    return {
      valid: false,
      dbPath: resolvedPath,
      bytes: 0,
      sha256: "",
      integrityCheck: "missing",
      foreignKeyViolations: 0,
      counts: {
        users: 0,
        patients: 0,
        visits: 0,
        consultations: 0,
        prescriptions: 0,
        expenses: 0,
        documents: 0,
      },
      error: "Backup database file does not exist.",
    };
  }

  const stat = statSync(resolvedPath);
  const sha256 = await computeFileSha256(resolvedPath);

  if (!hasValidSqliteHeader(resolvedPath)) {
    return {
      valid: false,
      dbPath: resolvedPath,
      bytes: stat.size,
      sha256,
      integrityCheck: "invalid_header",
      foreignKeyViolations: 0,
      counts: {
        users: 0,
        patients: 0,
        visits: 0,
        consultations: 0,
        prescriptions: 0,
        expenses: 0,
        documents: 0,
      },
      error: "File does not have a valid SQLite 3 header.",
    };
  }

  const tempClient = new PrismaClient({
    datasources: {
      db: { url: `file:${resolvedPath}` },
    },
    log: ["error"],
  });

  try {
    const integrityRows = await tempClient.$queryRawUnsafe<
      { integrity_check: string }[]
    >("PRAGMA integrity_check;");
    const integrityStatus =
      integrityRows?.[0]?.integrity_check ?? "unknown";

    const fkRows = await tempClient.$queryRawUnsafe<unknown[]>(
      "PRAGMA foreign_key_check;"
    );
    const fkViolations = Array.isArray(fkRows) ? fkRows.length : 0;

    const [
      users,
      patients,
      visits,
      consultations,
      prescriptions,
      expenses,
      documents,
    ] = await Promise.all([
      tempClient.user.count(),
      tempClient.patient.count(),
      tempClient.visit.count(),
      tempClient.consultation.count(),
      tempClient.prescription.count(),
      tempClient.expense.count(),
      tempClient.medicalDocument.count(),
    ]);

    const valid = integrityStatus === "ok" && fkViolations === 0;

    return {
      valid,
      dbPath: resolvedPath,
      bytes: stat.size,
      sha256,
      integrityCheck: integrityStatus,
      foreignKeyViolations: fkViolations,
      counts: {
        users,
        patients,
        visits,
        consultations,
        prescriptions,
        expenses,
        documents,
      },
      error: valid
        ? undefined
        : `Integrity check=${integrityStatus}, FK violations=${fkViolations}`,
    };
  } catch (err) {
    return {
      valid: false,
      dbPath: resolvedPath,
      bytes: stat.size,
      sha256,
      integrityCheck: "error",
      foreignKeyViolations: 0,
      counts: {
        users: 0,
        patients: 0,
        visits: 0,
        consultations: 0,
        prescriptions: 0,
        expenses: 0,
        documents: 0,
      },
      error:
        err instanceof Error
          ? err.message
          : "Failed to inspect SQLite database.",
    };
  } finally {
    await tempClient.$disconnect().catch(() => {});
  }
}

/**
 * Safely extracts an uploads ZIP archive into `targetUploadsDir`, rejecting
 * any archive entries that attempt path traversal (Zip-Slip protection).
 */
export async function extractUploadsArchive(
  uploadsZipPath: string,
  targetUploadsDir: string
): Promise<number> {
  const resolvedZip = path.resolve(uploadsZipPath);
  if (!existsSync(resolvedZip)) {
    throw new Error(`Uploads archive not found: ${resolvedZip}`);
  }

  const resolvedTargetRoot = path.resolve(targetUploadsDir);
  await mkdir(resolvedTargetRoot, { recursive: true });

  const zipBuffer = await readFile(resolvedZip);
  const zip = await JSZip.loadAsync(zipBuffer);

  let extractedCount = 0;
  const entries = Object.values(zip.files);

  for (const entry of entries) {
    if (entry.dir) continue;

    const rawEntryName =
      (entry as unknown as { unsafeOriginalName?: string })
        .unsafeOriginalName ?? entry.name;

    // Normalize separators and block traversal on both raw and parsed entry names
    for (const candidate of [rawEntryName, entry.name]) {
      const cleaned = candidate.replace(/\\/g, "/");
      if (
        cleaned.startsWith("/") ||
        cleaned.includes("..") ||
        cleaned.includes("\0") ||
        /^[a-zA-Z]:/.test(cleaned)
      ) {
        throw new Error(
          `Unsafe zip entry path rejected during restore: ${candidate}`
        );
      }
    }

    const cleanedName = entry.name.replace(/\\/g, "/");
    const destinationPath = path.resolve(resolvedTargetRoot, cleanedName);
    if (
      destinationPath !== resolvedTargetRoot &&
      !destinationPath.startsWith(resolvedTargetRoot + path.sep)
    ) {
      throw new Error(
        `Path traversal blocked for zip entry: ${entry.name}`
      );
    }

    await mkdir(path.dirname(destinationPath), { recursive: true });
    const content = await entry.async("nodebuffer");
    await writeFile(destinationPath, content);
    extractedCount += 1;
  }

  return extractedCount;
}

/**
 * Restores a SQLite database backup (and optional uploads ZIP archive) after
 * verifying backup integrity and creating a pre-restore safety snapshot.
 */
export async function restoreFromBackup(
  options: RestoreOptions
): Promise<RestoreResult> {
  const sourceDbPath = path.resolve(options.dbBackupPath);
  const targetDbPath = path.resolve(
    options.targetDbPath ?? resolveSqliteFile()
  );
  const targetUploads = path.resolve(
    options.targetUploadsDir ?? uploadDir()
  );
  const shouldSnapshot = options.createPreRestoreSnapshot ?? true;

  // 1. Validate source backup integrity before touching anything
  const preCheck = await inspectBackupDatabase(sourceDbPath);
  if (!preCheck.valid) {
    throw new Error(
      `Cannot restore from invalid or corrupted backup (${preCheck.error ?? "integrity check failed"}).`
    );
  }

  // 2. Create pre-restore safety snapshot if target exists
  let preRestoreSnapshotPath: string | null = null;
  if (shouldSnapshot && existsSync(targetDbPath)) {
    const slug = new Date().toISOString().replace(/[:.]/g, "-");
    preRestoreSnapshotPath = path.join(
      backupDir(),
      `pre-restore-${slug}.db`
    );
    await copyFile(targetDbPath, preRestoreSnapshotPath);
    logger.info("restore", "Created pre-restore safety database snapshot", {
      preRestoreSnapshotPath,
    });
  }

  // 3. Determine if we are restoring over the active Prisma database
  const activeDbPath = path.resolve(resolveSqliteFile());
  const isRestoringActiveDb = targetDbPath === activeDbPath;

  if (isRestoringActiveDb) {
    await prisma.$disconnect();
  }

  try {
    await mkdir(path.dirname(targetDbPath), { recursive: true });
    const stagingPath = `${targetDbPath}.restore-tmp`;
    await copyFile(sourceDbPath, stagingPath);

    // Remove stale WAL and SHM files so SQLite does not replay old frames onto the restored DB
    await rm(`${targetDbPath}-wal`, { force: true }).catch(() => {});
    await rm(`${targetDbPath}-shm`, { force: true }).catch(() => {});

    await rename(stagingPath, targetDbPath);
  } finally {
    if (isRestoringActiveDb) {
      await prisma.$connect();
    }
  }

  // 4. Restore uploaded documents if archive is provided
  let restoredFilesCount = 0;
  if (options.uploadsZipPath && existsSync(options.uploadsZipPath)) {
    restoredFilesCount = await extractUploadsArchive(
      options.uploadsZipPath,
      targetUploads
    );
  }

  // 5. Verify post-restore database integrity
  const postCheck = await inspectBackupDatabase(targetDbPath);
  if (!postCheck.valid) {
    throw new Error(
      `Post-restore verification failed: ${postCheck.error ?? "unknown error"}`
    );
  }

  logger.info("restore", "Database and uploads restore completed", {
    restoredDbPath: targetDbPath,
    restoredFilesCount,
    counts: postCheck.counts,
  });

  return {
    restoredDbPath: targetDbPath,
    preRestoreSnapshotPath,
    restoredFilesCount,
    inspection: postCheck,
  };
}
