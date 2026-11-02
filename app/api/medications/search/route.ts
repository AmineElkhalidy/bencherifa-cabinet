import { NextRequest } from "next/server";

import { ApiAuthError, requireApiRole } from "@/lib/auth/rbac";
import { searchMoroccanMedications } from "@/lib/medications/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiRole("DOCTOR");

    const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
    const suggestions = await searchMoroccanMedications(query);

    return Response.json(
      { suggestions },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ suggestions: [] }, { status: 500 });
  }
}
