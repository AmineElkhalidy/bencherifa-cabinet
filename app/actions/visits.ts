"use server";

import { revalidatePath } from "next/cache";

import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  visitCreateSchema,
  visitUpdateSchema,
} from "@/lib/validation/visit";

export type VisitCreateState =
  | { ok?: boolean; error?: string; visit?: { id: string } }
  | null;

export async function createVisit(
  _prev: VisitCreateState,
  formData: FormData
): Promise<VisitCreateState> {
  const session = await requireAuth();
  const parsed = visitCreateSchema.safeParse({
    patientId: formData.get("patientId"),
    visitType: formData.get("visitType") ?? "Consultation",
    price: formData.get("price"),
  });

  if (!parsed.success) {
    return { error: "Select a patient and verify the price." };
  }

  const patient = await prisma.patient.findUnique({
    where: { id: parsed.data.patientId },
    select: { id: true },
  });
  if (!patient) {
    return { error: "Selected patient does not exist." };
  }

  const price = parsed.data.visitType === "Control" ? 0 : parsed.data.price;

  const visit = await prisma.visit.create({
    data: {
      patientId: parsed.data.patientId,
      visitType: parsed.data.visitType,
      price,
      status: "Pending",
      date: new Date(),
    },
  });

  logger.info("visits", "Visit created", {
    visitId: visit.id,
    visitType: visit.visitType,
    byUserId: session.userId,
  });

  revalidatePath("/reception");
  revalidatePath("/doctor");
  revalidatePath("/doctor/analytics");
  revalidatePath("/doctor/waiting-list");
  revalidatePath(`/reception/patients/${parsed.data.patientId}`);

  return { ok: true, visit: { id: visit.id } };
}

export async function updateVisitStatus(id: string, status: string) {
  const session = await requireRole("DOCTOR");
  const parsed = visitUpdateSchema.safeParse({ status });
  if (!parsed.success) return { error: "Invalid status" };

  const existing = await prisma.visit.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { error: "Visit not found" };

  await prisma.visit.update({ where: { id }, data: parsed.data });
  logger.info("visits", "Visit status updated", {
    visitId: id,
    status: parsed.data.status,
    byUserId: session.userId,
  });
  revalidatePath("/doctor");
  revalidatePath("/doctor/waiting-list");
}
