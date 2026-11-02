/**
 * CLI utility for listing, inspecting/verifying, and restoring clinic backups.
 *
 * Usage:
 *   npm run backup:restore -- --list
 *   npm run backup:restore -- --verify <slug-or-db-path>
 *   npm run backup:restore -- --restore <slug-or-db-path>
 */
import { existsSync } from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ModuleWithResolve = typeof Module & {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string;
};

const stubPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "server-only-stub.cjs"
);
const mod = Module as ModuleWithResolve;
const resolveFilename = mod._resolveFilename;
mod._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (request === "server-only") return stubPath;
  return resolveFilename.call(this, request, parent, isMain, options);
};

function resolveBackupInputs(arg: string, backupsDir: string) {
  if (existsSync(arg)) {
    const dbPath = path.resolve(arg);
    const inferredZip = dbPath.replace(/\.db$/, "-uploads.zip");
    return {
      dbPath,
      uploadsZipPath: existsSync(inferredZip) ? inferredZip : null,
    };
  }

  const normalizedSlug = arg.replace(/^cabinet-/, "").replace(/\.db$/, "");
  const dbPath = path.join(backupsDir, `cabinet-${normalizedSlug}.db`);
  const zipPath = path.join(
    backupsDir,
    `cabinet-${normalizedSlug}-uploads.zip`
  );
  return {
    dbPath,
    uploadsZipPath: existsSync(zipPath) ? zipPath : null,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const { listAvailableBackups } = await import("@/lib/backup/runner");
  const { inspectBackupDatabase, restoreFromBackup } = await import(
    "@/lib/backup/restore"
  );
  const { backupDir } = await import("@/lib/storage");

  if (args.includes("--list") || args.length === 0) {
    const points = listAvailableBackups();
    console.log(
      JSON.stringify(
        { backupDir: backupDir(), count: points.length, backups: points },
        null,
        2
      )
    );
    return;
  }

  const verifyIdx = args.indexOf("--verify");
  if (verifyIdx !== -1) {
    const target = args[verifyIdx + 1];
    if (!target) {
      throw new Error("Missing argument after --verify <slug-or-db-path>");
    }
    const { dbPath } = resolveBackupInputs(target, backupDir());
    const result = await inspectBackupDatabase(dbPath);
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) {
      process.exit(1);
    }
    return;
  }

  const restoreIdx = args.indexOf("--restore");
  if (restoreIdx !== -1) {
    const target = args[restoreIdx + 1];
    if (!target) {
      throw new Error("Missing argument after --restore <slug-or-db-path>");
    }
    const { dbPath, uploadsZipPath } = resolveBackupInputs(
      target,
      backupDir()
    );
    console.log(`[backup-restore] Restoring from ${dbPath}...`);
    const result = await restoreFromBackup({
      dbBackupPath: dbPath,
      uploadsZipPath,
      createPreRestoreSnapshot: true,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(
    "Unknown arguments. Use --list, --verify <slug>, or --restore <slug>."
  );
}

main().catch((err) => {
  console.error("[backup-restore] failed:", err);
  process.exit(1);
});

