"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { patientSchema, patientUpdateSchema } from "@/lib/validation/patient";

export type PatientFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  patient?: { id: string };
} | null;

function readFormFields(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    age: formData.get("age") ?? "",
    gender: formData.get("gender") ?? "",
    phoneNumber: formData.get("phoneNumber") ?? "",
    cin: formData.get("cin") ?? "",
    insuranceProvider: formData.get("insuranceProvider") ?? "NONE",
    surgicalHistory: formData.get("surgicalHistory") ?? "",
    allergies: formData.get("allergies") ?? "",
    contraindications: formData.get("contraindications") ?? "",
  };
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
  await requireAuth();
  const parsed = patientSchema.safeParse(readFormFields(formData));
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
    console.error("[createPatient]", err);
    return { error: "Server error. Please try again." };
  }
}

export async function updatePatient(
  id: string,
  _prev: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  await requireAuth();
  const parsed = patientUpdateSchema.safeParse(readFormFields(formData));
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: "Please correct the invalid fields.",
    };
  }

  try {
    await prisma.patient.update({
      where: { id },
      data: normalizePatientData(parsed.data),
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
    console.error("[updatePatient]", err);
    return { error: "Server error. Please try again." };
  }
}

export async function deletePatient(id: string) {
  await requireAuth();
  await prisma.patient.delete({ where: { id } });
  revalidatePath("/reception/patients");
}
