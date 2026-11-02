"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { consultationSchema } from "@/lib/validation/consultation";

export type ConsultationFormState =
  | { ok?: boolean; error?: string; consultationId?: string }
  | null;

const TEXT_FIELDS = [
  "reasonForVisit",
  "hps",
  "rs",
  "pe",
  "vitals",
  "eco",
  "bloodWork",
  "clinicalNotes",
  "diagnosis",
  "prescribedTreatment",
  "dosageInstructions",
  "allergiesConsidered",
  "notes",
] as const;

function parseConsultationFormData(
  visitId: string,
  formData: FormData
): { data?: ReturnType<typeof consultationSchema.parse>; error?: string } {
  const raw: Record<string, unknown> = { visitId };
  for (const f of TEXT_FIELDS) raw[f] = formData.get(f) ?? "";
  raw.followUpDate = formData.get("followUpDate") || null;
  raw.hasCnss = formData.get("hasCnss") === "on";

  const parsed = consultationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Some fields are invalid." };
  }

  return { data: parsed.data };
}

function buildConsultationPayload(
  data: ReturnType<typeof consultationSchema.parse>
) {
  return {
    reasonForVisit: data.reasonForVisit,
    hps: data.hps,
    rs: data.rs,
    pe: data.pe,
    vitals: data.vitals,
    eco: data.eco,
    bloodWork: data.bloodWork,
    clinicalNotes: data.clinicalNotes,
    diagnosis: data.diagnosis,
    prescribedTreatment: data.prescribedTreatment,
    dosageInstructions: data.dosageInstructions,
    allergiesConsidered: data.allergiesConsidered,
    followUpDate: data.followUpDate ?? null,
    notes: data.notes,
    hasCnss: data.hasCnss,
  };
}

function revalidateConsultationPaths(visitId: string) {
  revalidatePath("/doctor");
  revalidatePath("/doctor/waiting-list");
  revalidatePath("/doctor/archives");
  revalidatePath("/doctor/analytics");
  revalidatePath(`/doctor/consultations/${visitId}`);
}

export async function saveConsultationDraft(
  visitId: string,
  formData: FormData
): Promise<ConsultationFormState> {
  const session = await requireRole("DOCTOR");

  const parsed = parseConsultationFormData(visitId, formData);
  if (parsed.error || !parsed.data) {
    return { error: parsed.error };
  }

  try {
    const visit = await prisma.visit.findUnique({
      where: { id: parsed.data.visitId },
      select: { id: true },
    });
    if (!visit) {
      return { error: "Visit not found." };
    }

    const payload = buildConsultationPayload(parsed.data);
    const saved = await prisma.consultation.upsert({
      where: { visitId: parsed.data.visitId },
      create: { visitId: parsed.data.visitId, ...payload },
      update: payload,
    });

    revalidateConsultationPaths(visitId);
    return { ok: true, consultationId: saved.id };
  } catch (err) {
    logger.error("consultations", "Failed to save consultation draft", {
      visitId,
      byUserId: session.userId,
      error: err,
    });
    return { error: "Failed to save consultation draft." };
  }
}

export async function completeConsultation(
  visitId: string,
  _prev: ConsultationFormState,
  formData: FormData
): Promise<ConsultationFormState> {
  const session = await requireRole("DOCTOR");

  const parsed = parseConsultationFormData(visitId, formData);
  if (parsed.error || !parsed.data) {
    return { error: parsed.error };
  }

  try {
    const visit = await prisma.visit.findUnique({
      where: { id: parsed.data.visitId },
      select: { id: true },
    });
    if (!visit) {
      return { error: "Visit not found." };
    }

    const payload = buildConsultationPayload(parsed.data);

    // Atomic transaction: upsert consultation AND mark visit Completed together
    const saved = await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.upsert({
        where: { visitId: parsed.data!.visitId },
        create: { visitId: parsed.data!.visitId, ...payload },
        update: payload,
      });

      await tx.visit.update({
        where: { id: parsed.data!.visitId },
        data: { status: "Completed" },
      });

      return consultation;
    });

    logger.info("consultations", "Consultation completed", {
      visitId: parsed.data.visitId,
      consultationId: saved.id,
      byUserId: session.userId,
    });

    revalidateConsultationPaths(parsed.data.visitId);

    return { ok: true, consultationId: saved.id };
  } catch (err) {
    logger.error("consultations", "Failed to complete consultation", {
      visitId,
      byUserId: session.userId,
      error: err,
    });
    return { error: "Failed to complete consultation." };
  }
}

export async function reopenVisit(visitId: string) {
  const session = await requireRole("DOCTOR");
  await prisma.visit.update({
    where: { id: visitId },
    data: { status: "Pending" },
  });
  logger.info("consultations", "Visit reopened", {
    visitId,
    byUserId: session.userId,
  });
  revalidatePath("/doctor");
  revalidatePath("/doctor/waiting-list");
}
