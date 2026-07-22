import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/rbac";
import { searchMoroccanMedications } from "@/lib/medications/catalog";

export async function GET(request: NextRequest) {
  await requireRole("DOCTOR");

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const suggestions = await searchMoroccanMedications(query);

  return Response.json({ suggestions });
}
