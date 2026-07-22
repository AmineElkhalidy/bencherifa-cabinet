import { revalidatePath } from "next/cache";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { ensureDir, safeBasename, uploadDir } from "@/lib/storage";

export const runtime = "nodejs";

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
  await requireRole("DOCTOR");

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid multipart payload" }, { status: 400 });
  }

  const file = formData.get("file");
  const consultationId = String(formData.get("consultationId") ?? "");
  const documentType = String(formData.get("documentType") ?? "other");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file received." }, { status: 400 });
  }
  if (!consultationId) {
    return Response.json(
      { error: "Missing consultationId." },
      { status: 400 }
    );
  }
  if (!ACCEPTED_MIME.has(file.type)) {
    return Response.json(
      { error: `Unsupported file type (${file.type}).` },
      { status: 415 }
    );
  }
  if (file.size > maxBytes()) {
    return Response.json(
      { error: `File is too large (max ${process.env.MAX_UPLOAD_MB ?? 10} MB).` },
      { status: 413 }
    );
  }

  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    select: { id: true },
  });
  if (!consultation) {
    return Response.json({ error: "Consultation not found." }, { status: 404 });
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

  const ext = path.extname(file.name) || guessExt(file.type);
  const filename = `${randomUUID()}-${safeBasename(file.name).replace(/\.[^.]+$/, "")}${ext}`;
  const absolute = path.join(dir, filename);
  const relative = path.posix.join(subdir.replace(/\\/g, "/"), filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolute, buffer);

  const created = await prisma.medicalDocument.create({
    data: {
      consultationId,
      fileUrl: relative,
      documentType: type,
    },
  });

  revalidatePath("/doctor");
  return Response.json({
    id: created.id,
    fileUrl: created.fileUrl,
    documentType: created.documentType,
    createdAt: created.createdAt.toISOString(),
  });
}

function guessExt(mime: string) {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}
