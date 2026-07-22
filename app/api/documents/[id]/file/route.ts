import { promises as fs } from "node:fs";
import path from "node:path";

import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
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
  await requireRole("DOCTOR");
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

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(absolute);
  } catch {
    return new Response("File missing on disk", { status: 410 });
  }

  const ext = path.extname(absolute).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  // Build a fresh ArrayBuffer so the Response body is unambiguous (some
  // bundlers complain about Buffer | ArrayBufferLike unions otherwise).
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);

  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, max-age=300",
    },
  });
}
