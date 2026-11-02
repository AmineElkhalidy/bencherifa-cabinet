import "server-only";

import { createWriteStream } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import archiverPkg from "archiver";

const createArchiver = (
  typeof archiverPkg === "function"
    ? archiverPkg
    : (archiverPkg as unknown as { default: typeof archiverPkg }).default
) as typeof archiverPkg;

async function dirHasFiles(dir: string): Promise<boolean> {
  try {
    await access(dir);
  } catch {
    return false;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile()) return true;
    if (entry.isDirectory() && (await dirHasFiles(full))) return true;
  }
  return false;
}

/**
 * Zips `sourceDir` into `destZipPath`. Returns false when the directory
 * is missing or empty (no artifact should be produced).
 */
export async function zipDirectory(
  sourceDir: string,
  destZipPath: string
): Promise<boolean> {
  if (!(await dirHasFiles(sourceDir))) return false;

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(destZipPath);
    const archive = createArchiver("zip", { zlib: { level: 6 } });

    output.on("close", () => resolve());
    archive.on("error", reject);
    output.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });

  const info = await stat(destZipPath);
  return info.size > 0;
}
