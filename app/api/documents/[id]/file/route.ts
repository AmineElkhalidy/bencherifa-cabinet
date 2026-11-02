import "server-only";

import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { ApiAuthError, requireApiRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { resolveUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiRole("DOCTOR");
    const { id } = await ctx.params;

    const doc = await prisma.medicalDocument.findUnique({ where: { id } });
    if (!doc) {
      return new Response("Not found", { status: 404 });
    }

    let absolute: string;
    try {
      absolute = resolveUpload(doc.fileUrl);
    } catch {
      return new Response("Forbidden", { status: 403 });
    }

    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(absolute);
      if (!stat.isFile()) {
        return new Response("Not found", { status: 404 });
      }
    } catch {
      return new Response("File missing on disk", { status: 410 });
    }

    const ext = path.extname(absolute).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    const safeFilename = path.basename(absolute).replace(/[^a-zA-Z0-9._-]/g, "_");

    const nodeStream = createReadStream(absolute);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(stat.size),
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, private",
      },
    });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    logger.error("documents", "Failed to stream document", { error: err });
    return new Response("Internal server error", { status: 500 });
  }
}
