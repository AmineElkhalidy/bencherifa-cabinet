import "server-only";

import { revalidatePath } from "next/cache";
import { promises as fs } from "node:fs";

import { ApiAuthError, requireApiRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { resolveUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireApiRole("DOCTOR");
    const { id } = await ctx.params;
    const doc = await prisma.medicalDocument.findUnique({ where: { id } });
    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.medicalDocument.delete({ where: { id } });
    try {
      const absolute = resolveUpload(doc.fileUrl);
      await fs.unlink(absolute);
    } catch {
      // file might already be missing — DB row removal is the source of truth
    }

    logger.info("documents", "Medical document deleted", {
      documentId: id,
      byUserId: session.userId,
    });

    revalidatePath("/doctor");
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    logger.error("documents", "Failed to delete document", { error: err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
