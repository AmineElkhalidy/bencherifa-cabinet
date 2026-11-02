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

export const resolveSqliteFile = databasePath;

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
  if (
    fileUrl.includes("..") ||
    fileUrl.includes("\0") ||
    path.isAbsolute(fileUrl)
  ) {
    throw new Error("Invalid upload path");
  }
  const base = path.resolve(uploadDir());
  const cleaned = fileUrl.replace(/^\/+/, "").replace(/^uploads[\\/]+/, "");
  const resolved = path.resolve(base, cleaned);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error("Invalid upload path");
  }
  return resolved;
}

/**
 * Inspects the first bytes (magic signature) of an uploaded buffer to
 * determine the true file format and return its canonical extension (`.png`, `.jpg`, `.gif`, `.webp`, `.pdf`).
 * Returns null if the signature does not match an allowed medical document format.
 */
export function detectAllowedFileExtension(
  buffer: Buffer,
  declaredMime: string
): string | null {
  if (buffer.length < 4) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return declaredMime === "image/png" ? ".png" : null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return declaredMime === "image/jpeg" ? ".jpg" : null;
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return declaredMime === "image/gif" ? ".gif" : null;
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return declaredMime === "image/webp" ? ".webp" : null;
  }

  // PDF: %PDF-
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return declaredMime === "application/pdf" ? ".pdf" : null;
  }

  return null;
}
