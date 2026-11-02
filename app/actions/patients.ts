"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { patientSchema, patientUpdateSchema } from "@/lib/validation/patient";

export type PatientFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  patient?: { id: string };
} | null;

function readFormFields(formData: FormData, includeMedicalHistory: boolean) {
  const base: Record<string, unknown> = {
    name: formData.get("name") ?? "",
    age: formData.get("age") ?? "",
    gender: formData.get("gender") ?? "",
    phoneNumber: formData.get("phoneNumber") ?? "",
    cin: formData.get("cin") ?? "",
    insuranceProvider: formData.get("insuranceProvider") ?? "NONE",
  };
  if (includeMedicalHistory) {
    base.surgicalHistory = formData.get("surgicalHistory") ?? "";
    base.allergies = formData.get("allergies") ?? "";
    base.contraindications = formData.get("contraindications") ?? "";
  }
  return base;
}

function normalizePatientData<T extends { cin?: string; phoneNumber?: string }>(
  data: T
) {
  const trimmedCin = data.cin?.trim();
  const trimmedPhone = data.phoneNumber?.trim();
  return {
    ...data,
    cin: trimmedCin ? trimmedCin : null,
    phoneNumber: trimmedPhone ? trimmedPhone : null,
  };
}

export async function createPatient(
  _prev: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const session = await requireAuth();
  const isDoctor = session.role === "DOCTOR";
  const parsed = patientSchema.safeParse(readFormFields(formData, isDoctor));
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: "Please correct the invalid fields.",
    };
  }

  try {
    const patient = await prisma.patient.create({
      data: normalizePatientData(parsed.data),
    });
    logger.info("patients", "Patient created", {
      patientId: patient.id,
      byUserId: session.userId,
    });
    revalidatePath("/reception/patients");
    revalidatePath("/reception");
    return { ok: true, patient: { id: patient.id } };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        error: "A patient with this CIN already exists.",
        fieldErrors: { cin: ["CIN already registered."] },
      };
    }
    logger.error("patients", "Failed to create patient", { error: err });
    return { error: "Server error. Please try again." };
  }
}

export async function updatePatient(
  id: string,
  _prev: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const session = await requireAuth();
  const isDoctor = session.role === "DOCTOR";
  const parsed = patientUpdateSchema.safeParse(
    readFormFields(formData, isDoctor)
  );
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: "Please correct the invalid fields.",
    };
  }

  try {
    const updatePayload = normalizePatientData(parsed.data);
    // If not a doctor, preserve existing clinical history fields
    if (!isDoctor) {
      delete (updatePayload as Record<string, unknown>).surgicalHistory;
      delete (updatePayload as Record<string, unknown>).allergies;
      delete (updatePayload as Record<string, unknown>).contraindications;
    }

    await prisma.patient.update({
      where: { id },
      data: updatePayload,
    });
    logger.info("patients", "Patient updated", {
      patientId: id,
      byUserId: session.userId,
    });
    revalidatePath("/reception/patients");
    revalidatePath(`/reception/patients/${id}`);
    return { ok: true, patient: { id } };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        error: "Another patient already uses this CIN.",
        fieldErrors: { cin: ["CIN already registered."] },
      };
    }
    logger.error("patients", "Failed to update patient", { error: err });
    return { error: "Server error. Please try again." };
  }
}

export async function deletePatient(id: string) {
  const session = await requireRole("DOCTOR");
  await prisma.patient.delete({ where: { id } });
  logger.info("patients", "Patient deleted", {
    patientId: id,
    byUserId: session.userId,
  });
  revalidatePath("/reception/patients");
}
