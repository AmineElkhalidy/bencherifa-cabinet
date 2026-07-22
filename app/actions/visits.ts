"use server";

import { revalidatePath } from "next/cache";

import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
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
  await requireAuth();
  const parsed = visitCreateSchema.safeParse({
    patientId: formData.get("patientId"),
    visitType: formData.get("visitType") ?? "Consultation",
    price: formData.get("price"),
  });

  if (!parsed.success) {
    return { error: "Select a patient and verify the price." };
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

  revalidatePath("/reception");
  revalidatePath("/doctor");
  revalidatePath("/doctor/analytics");
  revalidatePath("/doctor/waiting-list");
  revalidatePath(`/reception/patients/${parsed.data.patientId}`);

  return { ok: true, visit: { id: visit.id } };
}

export async function updateVisitStatus(id: string, status: string) {
  await requireRole("DOCTOR");
  const parsed = visitUpdateSchema.safeParse({ status });
  if (!parsed.success) return { error: "Invalid status" };
  await prisma.visit.update({ where: { id }, data: parsed.data });
  revalidatePath("/doctor");
  revalidatePath("/doctor/waiting-list");
}
