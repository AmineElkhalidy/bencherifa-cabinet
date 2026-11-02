import "server-only";

import { ApiAuthError, requireApiRole } from "@/lib/auth/rbac";
import { runBackup } from "@/lib/backup/runner";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireApiRole("DOCTOR");
    const summary = await runBackup();
    logger.info("backup", "Manual backup executed", {
      byUserId: session.userId,
      durationMs: summary.durationMs,
      artifactCount: summary.artifacts.length,
    });
    return Response.json(summary, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    logger.error("backup", "Manual backup failed", { error: err });
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erreur inconnue pendant la sauvegarde.",
      },
      { status: 500 }
    );
  }
}
