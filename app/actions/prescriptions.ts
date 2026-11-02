"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
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
  const rawItems: {
    medication: string;
    medicationType: string;
    duration: string;
    doseMorning: number;
    doseNoon: number;
    doseEvening: number;
  }[] = [];

  for (let i = 0; i < 50; i++) {
    const medication = formData.get(`items[${i}].medication`);
    if (medication === null) break;
    rawItems.push({
      medication: String(medication),
      medicationType: String(formData.get(`items[${i}].medicationType`) ?? ""),
      duration: String(formData.get(`items[${i}].duration`) ?? ""),
      doseMorning: Number(formData.get(`items[${i}].doseMorning`) ?? 0),
      doseNoon: Number(formData.get(`items[${i}].doseNoon`) ?? 0),
      doseEvening: Number(formData.get(`items[${i}].doseEvening`) ?? 0),
    });
  }

  const nonEmpty = rawItems.filter((item) => item.medication.trim().length > 0);

  // Deduplicate identical medication + type entries (case-insensitive) while preserving order
  const seen = new Set<string>();
  const deduplicated: typeof nonEmpty = [];
  for (const item of nonEmpty) {
    const key = `${item.medication.trim().toLowerCase()}|${item.medicationType.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push(item);
  }

  return deduplicated;
}

export async function savePrescriptionDraft(
  visitId: string,
  formData: FormData
): Promise<PrescriptionDraftState> {
  const session = await requireRole("DOCTOR");

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

  try {
    const visit = await prisma.visit.findUnique({
      where: { id: parsed.data.visitId },
      include: { consultation: true },
    });

    if (!visit) {
      return { error: "Visit not found." };
    }

    const items = parsed.data.items;
    const summary = items.length > 0 ? formatPrescriptionSummary(items) : "";

    const result = await prisma.$transaction(async (tx) => {
      let consultationId = visit.consultation?.id;

      if (!consultationId) {
        const created = await tx.consultation.create({
          data: { visitId: visit.id },
        });
        consultationId = created.id;
      }

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
          return { prescription: existing, consultationId };
        }

        await tx.consultation.update({
          where: { id: consultationId },
          data: {
            prescribedTreatment: "",
            dosageInstructions: "",
          },
        });
        return { prescription: null, consultationId };
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

      return { prescription: saved, consultationId };
    });

    revalidatePrescriptionPaths(visitId);

    return {
      ok: true,
      prescriptionId: result.prescription?.id,
      itemCount: items.length,
      consultationId: result.consultationId,
    };
  } catch (err) {
    logger.error("prescriptions", "Failed to save prescription draft", {
      visitId,
      byUserId: session.userId,
      error: err,
    });
    return { error: "Failed to save prescription." };
  }
}
