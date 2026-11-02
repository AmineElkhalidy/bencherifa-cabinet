import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiAuthError, requireApiRole } from "@/lib/auth/rbac";
import { inspectBackupDatabase, restoreFromBackup } from "@/lib/backup/restore";
import { logger } from "@/lib/logger";
import { backupDir } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const restoreRequestSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(
      /^(\d{8}T\d{6}|\d{4}-\d{2}-\d{2}T[\d-]+Z)$/,
      "Format d'identifiant de sauvegarde invalide."
    ),
  mode: z.enum(["verify", "restore"]).default("verify"),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiRole("DOCTOR");

    const body = await request.json().catch(() => null);
    const parsed = restoreRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Paramètres de requête invalides.",
        },
        { status: 400 }
      );
    }

    const { slug, mode } = parsed.data;
    const root = path.resolve(backupDir());
    const dbPath = path.resolve(root, `cabinet-${slug}.db`);
    const uploadsZipPath = path.resolve(root, `cabinet-${slug}-uploads.zip`);

    if (!dbPath.startsWith(root + path.sep) || !existsSync(dbPath)) {
      return NextResponse.json(
        { error: "Fichier de sauvegarde introuvable." },
        { status: 404 }
      );
    }

    if (mode === "verify") {
      const inspection = await inspectBackupDatabase(dbPath);
      return NextResponse.json({ mode: "verify", inspection });
    }

    logger.warn("restore", "Doctor initiated database restore", {
      actorId: session.userId,
      slug,
    });

    const result = await restoreFromBackup({
      dbBackupPath: dbPath,
      uploadsZipPath: existsSync(uploadsZipPath) ? uploadsZipPath : null,
      createPreRestoreSnapshot: true,
    });

    return NextResponse.json({ mode: "restore", result });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      );
    }
    logger.error("restore", "Backup verify/restore API failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Échec de l'opération de restauration.",
      },
      { status: 500 }
    );
  }
}
