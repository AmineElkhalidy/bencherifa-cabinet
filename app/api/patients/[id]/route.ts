import "server-only";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import {
  ApiAuthError,
  requireApiAuth,
  requireApiRole,
} from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { patientUpdateSchema } from "@/lib/validation/patient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizePatientForRole(
  patient: {
    id: string;
    name: string;
    age: string;
    gender: string;
    phoneNumber: string | null;
    cin: string | null;
    insuranceProvider: string;
    surgicalHistory: string;
    allergies: string;
    contraindications: string;
    createdAt: Date;
    updatedAt: Date;
  },
  role: string
) {
  if (role === "DOCTOR") {
    return patient;
  }
  return {
    id: patient.id,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    phoneNumber: patient.phoneNumber,
    cin: patient.cin,
    insuranceProvider: patient.insuranceProvider,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireApiAuth();
    const { id } = await ctx.params;
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(sanitizePatientForRole(patient, session.role), {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    logger.error("api:patients", "Failed GET patient", { error: err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireApiAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = patientUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if ("cin" in updateData) {
      const trimmed = String(updateData.cin ?? "").trim();
      updateData.cin = trimmed ? trimmed : null;
    }
    if ("phoneNumber" in updateData) {
      const trimmed = String(updateData.phoneNumber ?? "").trim();
      updateData.phoneNumber = trimmed ? trimmed : null;
    }

    // Receptionists cannot modify clinical medical history fields via PATCH
    if (session.role !== "DOCTOR") {
      delete updateData.surgicalHistory;
      delete updateData.allergies;
      delete updateData.contraindications;
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData,
    });
    revalidatePath("/reception/patients");
    revalidatePath(`/reception/patients/${id}`);
    return Response.json(sanitizePatientForRole(patient, session.role), {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return Response.json(
        { error: "Another patient already uses this CIN." },
        { status: 409 }
      );
    }
    logger.error("api:patients", "Failed PATCH patient", { error: err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiRole("DOCTOR");
    const { id } = await ctx.params;
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.patient.delete({ where: { id } });
    revalidatePath("/reception/patients");
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    logger.error("api:patients", "Failed DELETE patient", { error: err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
