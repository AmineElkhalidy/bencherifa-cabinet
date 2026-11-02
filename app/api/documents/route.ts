import "server-only";

import { revalidatePath } from "next/cache";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { ApiAuthError, requireApiRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { logger } from "@/lib/logger";
import {
  detectAllowedFileExtension,
  ensureDir,
  safeBasename,
  uploadDir,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCEPTED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function maxBytes() {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? 10);
  return Math.max(1, mb) * 1024 * 1024;
}

export async function POST(req: Request) {
  try {
    const session = await requireApiRole("DOCTOR");

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json(
        { error: "Invalid multipart payload" },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    const consultationId = String(formData.get("consultationId") ?? "").trim();
    const documentType = String(formData.get("documentType") ?? "other").trim();

    if (!(file instanceof File)) {
      return Response.json({ error: "No file received." }, { status: 400 });
    }
    if (!consultationId || consultationId.length > 64) {
      return Response.json(
        { error: "Missing or invalid consultationId." },
        { status: 400 }
      );
    }
    if (!ACCEPTED_MIME.has(file.type)) {
      return Response.json(
        { error: `Unsupported file type (${file.type || "unknown"}).` },
        { status: 415 }
      );
    }
    if (file.size === 0) {
      return Response.json({ error: "Uploaded file is empty." }, { status: 400 });
    }
    if (file.size > maxBytes()) {
      return Response.json(
        {
          error: `File is too large (max ${process.env.MAX_UPLOAD_MB ?? 10} MB).`,
        },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const canonicalExt = detectAllowedFileExtension(buffer, file.type);
    if (!canonicalExt) {
      return Response.json(
        {
          error:
            "File content signature does not match an allowed format (PNG, JPEG, WEBP, GIF, or PDF).",
        },
        { status: 415 }
      );
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true },
    });
    if (!consultation) {
      return Response.json(
        { error: "Consultation not found." },
        { status: 404 }
      );
    }

    const type = DOCUMENT_TYPES.includes(
      documentType as (typeof DOCUMENT_TYPES)[number]
    )
      ? documentType
      : "other";

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const subdir = path.join(yyyy, mm);
    const dir = path.join(uploadDir(), subdir);
    await ensureDir(dir);

    const baseStem =
      safeBasename(file.name.replace(/\.[^.]+$/, "")).replace(/^\.+/, "") ||
      "document";
    const filename = `${randomUUID()}-${baseStem}${canonicalExt}`;
    const absolute = path.join(dir, filename);
    const relative = path.posix.join(subdir.replace(/\\/g, "/"), filename);

    // Use flag 'wx' to ensure we never overwrite an existing file
    await fs.writeFile(absolute, buffer, { flag: "wx" });

    try {
      const created = await prisma.medicalDocument.create({
        data: {
          consultationId,
          fileUrl: relative,
          documentType: type,
        },
      });

      logger.info("documents", "Medical document uploaded", {
        documentId: created.id,
        consultationId,
        documentType: type,
        bytes: buffer.byteLength,
        byUserId: session.userId,
      });

      revalidatePath("/doctor");
      return Response.json({
        id: created.id,
        fileUrl: created.fileUrl,
        documentType: created.documentType,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (dbErr) {
      // Clean up orphaned file if DB insert fails
      await fs.unlink(absolute).catch(() => undefined);
      throw dbErr;
    }
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    logger.error("documents", "Failed to upload document", { error: err });
    return Response.json(
      { error: "Failed to store medical document." },
      { status: 500 }
    );
  }
}
