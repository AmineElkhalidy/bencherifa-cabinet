import { revalidatePath } from "next/cache";
import { promises as fs } from "node:fs";

import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { resolveUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireRole("DOCTOR");
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
  revalidatePath("/doctor");
  return Response.json({ ok: true });
}
