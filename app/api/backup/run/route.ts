import { requireRole } from "@/lib/auth/rbac";
import { runBackup } from "@/lib/backup/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await requireRole("DOCTOR");
  try {
    const summary = await runBackup();
    return Response.json(summary);
  } catch (err) {
    console.error("[backup/run]", err);
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
