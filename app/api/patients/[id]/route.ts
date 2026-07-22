import { revalidatePath } from "next/cache";

import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { patientUpdateSchema } from "@/lib/validation/patient";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await ctx.params;
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(patient);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = patientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const patient = await prisma.patient.update({
    where: { id },
    data: parsed.data,
  });
  revalidatePath("/reception/patients");
  revalidatePath(`/reception/patients/${id}`);
  return Response.json(patient);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireRole("DOCTOR");
  const { id } = await ctx.params;
  await prisma.patient.delete({ where: { id } });
  revalidatePath("/reception/patients");
  return Response.json({ ok: true });
}
