"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import {
  prescriptionDraftSchema,
  prescriptionSchema,
} from "@/lib/validation/prescription";

export type PrescriptionDraftState =
  | {
      ok?: boolean;
      error?: string;
      prescriptionId?: string;
      itemCount?: number;
      consultationId?: string;
    }
  | null;

function formatTreatmentDuration(duration: string) {
  const trimmed = duration.trim();
  if (!trimmed) return "";

  const numericMatch = trimmed.match(/^(\d+)$/);
  if (numericMatch) {
    const days = Number(numericMatch[1]);
    return `(${days} ${days > 1 ? "jours" : "jour"})`;
  }

  const frenchMatch = trimmed.match(/^(\d+)\s*jour(s)?$/i);
  if (frenchMatch) {
    const days = Number(frenchMatch[1]);
    return `(${days} ${days > 1 ? "jours" : "jour"})`;
  }

  return `(${trimmed})`;
}

function formatMedicationLabel(medication: string, medicationType: string) {
  const name = medication.trim();
  const form = medicationType.trim();
  return form ? `${name} — ${form}` : name;
}

function formatPrescriptionSummary(
  items: {
    medication: string;
    medicationType: string;
    duration: string;
    doseMorning: number;
    doseNoon: number;
    doseEvening: number;
  }[]
) {
  return items
    .map(
      (item, i) =>
        `${i + 1}. ${formatMedicationLabel(item.medication, item.medicationType)} — ${item.doseMorning}-${item.doseNoon}-${item.doseEvening} ${formatTreatmentDuration(item.duration)}`
    )
    .join("\n");
}

function revalidatePrescriptionPaths(visitId: string) {
  revalidatePath("/doctor/archives");
  revalidatePath(`/doctor/consultations/${visitId}`);
  revalidatePath(`/doctor/consultations/${visitId}/prescription`);
}

function parsePrescriptionItems(formData: FormData) {
  const items: {
    medication: string;
    medicationType: string;
    duration: string;
    doseMorning: number;
    doseNoon: number;
    doseEvening: number;
  }[] = [];

  for (let i = 0; ; i++) {
    const medication = formData.get(`items[${i}].medication`);
    if (medication === null) break;
    items.push({
      medication: String(medication),
      medicationType: String(formData.get(`items[${i}].medicationType`) ?? ""),
      duration: String(formData.get(`items[${i}].duration`) ?? ""),
      doseMorning: Number(formData.get(`items[${i}].doseMorning`) ?? 0),
      doseNoon: Number(formData.get(`items[${i}].doseNoon`) ?? 0),
      doseEvening: Number(formData.get(`items[${i}].doseEvening`) ?? 0),
    });
  }

  return items.filter((item) => item.medication.trim().length > 0);
}

export async function savePrescriptionDraft(
  visitId: string,
  formData: FormData
): Promise<PrescriptionDraftState> {
  await requireRole("DOCTOR");

  const prescriptionDate = String(
    formData.get("prescriptionDate") ?? new Date().toISOString().slice(0, 10)
  );

  const draftParsed = prescriptionDraftSchema.safeParse({
    visitId,
    prescriptionDate,
    items: parsePrescriptionItems(formData),
  });

  if (!draftParsed.success) {
    const first = draftParsed.error.issues[0]?.message;
    return { error: first ?? "Invalid prescription." };
  }

  const parsed =
    draftParsed.data.items.length > 0
      ? prescriptionSchema.safeParse(draftParsed.data)
      : draftParsed;

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { error: first ?? "Invalid prescription." };
  }

  const visit = await prisma.visit.findUnique({
    where: { id: parsed.data.visitId },
    include: { consultation: true },
  });

  if (!visit) {
    return { error: "Visit not found." };
  }

  let consultationId = visit.consultation?.id;

  if (!consultationId) {
    const created = await prisma.consultation.create({
      data: { visitId: visit.id },
    });
    consultationId = created.id;
  }

  const items = parsed.data.items;
  const summary = items.length > 0 ? formatPrescriptionSummary(items) : "";

  const prescription = await prisma.$transaction(async (tx) => {
    const existing = await tx.prescription.findUnique({
      where: { consultationId },
    });

    if (existing) {
      await tx.prescriptionItem.deleteMany({
        where: { prescriptionId: existing.id },
      });
    }

    if (items.length === 0) {
      if (existing) {
        await tx.prescription.update({
          where: { id: existing.id },
          data: { prescriptionDate: parsed.data.prescriptionDate },
        });
        await tx.consultation.update({
          where: { id: consultationId },
          data: {
            prescribedTreatment: "",
            dosageInstructions: "",
          },
        });
        return existing;
      }

      await tx.consultation.update({
        where: { id: consultationId },
        data: {
          prescribedTreatment: "",
          dosageInstructions: "",
        },
      });
      return null;
    }

    const saved = await tx.prescription.upsert({
      where: { consultationId },
      create: {
        consultationId,
        prescriptionDate: parsed.data.prescriptionDate,
        items: {
          create: items.map((item, index) => ({
            ...item,
            sortOrder: index,
          })),
        },
      },
      update: {
        prescriptionDate: parsed.data.prescriptionDate,
        items: {
          create: items.map((item, index) => ({
            ...item,
            sortOrder: index,
          })),
        },
      },
      include: { items: true },
    });

    await tx.consultation.update({
      where: { id: consultationId },
      data: {
        prescribedTreatment: summary,
        dosageInstructions:
          "Type — Matin — Midi — Soir — Durée (voir ordonnance imprimée)",
      },
    });

    return saved;
  });

  revalidatePrescriptionPaths(visitId);

  return {
    ok: true,
    prescriptionId: prescription?.id,
    itemCount: items.length,
    consultationId,
  };
}
