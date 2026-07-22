import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Returns absolute paths for the persistent volume directories.
 * In Docker the volume is mounted at /app/data, but locally we fall
 * back to <projectRoot>/data so `npm run dev` works without changes.
 */
export function dataRoot() {
  const fromEnv = process.env.UPLOAD_DIR
    ? path.dirname(process.env.UPLOAD_DIR)
    : null;
  return fromEnv && path.isAbsolute(fromEnv)
    ? fromEnv
    : path.resolve(process.cwd(), "data");
}

export function uploadDir() {
  const fromEnv = process.env.UPLOAD_DIR;
  return fromEnv && path.isAbsolute(fromEnv)
    ? fromEnv
    : path.resolve(process.cwd(), "data", "uploads");
}

export function backupDir() {
  const fromEnv = process.env.BACKUP_DIR;
  return fromEnv && path.isAbsolute(fromEnv)
    ? fromEnv
    : path.resolve(process.cwd(), "data", "backups");
}

/** Absolute path to the SQLite file referenced by `DATABASE_URL`. */
export function databasePath() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) {
    return path.join(dataRoot(), "cabinet.db");
  }
  const filePath = url.slice("file:".length);
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Sanitize a filename, keeping only alnum, dot, dash and underscore.
 */
export function safeBasename(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
}

/**
 * Resolve a relative `fileUrl` (as stored in DB) into an absolute path,
 * making sure it stays inside the upload directory (path-traversal safe).
 */
export function resolveUpload(fileUrl: string) {
  const base = uploadDir();
  const cleaned = fileUrl.replace(/^\/+/, "").replace(/^uploads[\\/]+/, "");
  const resolved = path.resolve(base, cleaned);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error("Invalid file path");
  }
  return resolved;
}
