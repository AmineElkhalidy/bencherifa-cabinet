"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
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

async function upsertConsultation(
  data: ReturnType<typeof consultationSchema.parse>
): Promise<{ consultationId: string } | { error: string }> {
  const existing = await prisma.consultation.findUnique({
    where: { visitId: data.visitId },
  });

  const payload = {
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

  if (existing) {
    const updated = await prisma.consultation.update({
      where: { visitId: data.visitId },
      data: payload,
    });
    return { consultationId: updated.id };
  }

  const created = await prisma.consultation.create({
    data: { visitId: data.visitId, ...payload },
  });
  return { consultationId: created.id };
}

function revalidateConsultationPaths(visitId: string) {
  revalidatePath("/doctor");
  revalidatePath("/doctor/waiting-list");
  revalidatePath("/doctor/archives");
  revalidatePath(`/doctor/consultations/${visitId}`);
}

export async function saveConsultationDraft(
  visitId: string,
  formData: FormData
): Promise<ConsultationFormState> {
  await requireRole("DOCTOR");

  const parsed = parseConsultationFormData(visitId, formData);
  if (parsed.error || !parsed.data) {
    return { error: parsed.error };
  }

  const result = await upsertConsultation(parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidateConsultationPaths(visitId);

  return { ok: true, consultationId: result.consultationId };
}

export async function completeConsultation(
  visitId: string,
  _prev: ConsultationFormState,
  formData: FormData
): Promise<ConsultationFormState> {
  await requireRole("DOCTOR");

  const parsed = parseConsultationFormData(visitId, formData);
  if (parsed.error || !parsed.data) {
    return { error: parsed.error };
  }

  const result = await upsertConsultation(parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  await prisma.visit.update({
    where: { id: parsed.data.visitId },
    data: { status: "Completed" },
  });

  revalidateConsultationPaths(parsed.data.visitId);

  return { ok: true, consultationId: result.consultationId };
}

export async function reopenVisit(visitId: string) {
  await requireRole("DOCTOR");
  await prisma.visit.update({
    where: { id: visitId },
    data: { status: "Pending" },
  });
  revalidatePath("/doctor");
  revalidatePath("/doctor/waiting-list");
}
