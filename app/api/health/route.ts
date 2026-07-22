import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { APP_CONFIG } from "@/lib/config";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      service: APP_CONFIG.clinicName,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      {
        status: "degraded",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }
}
