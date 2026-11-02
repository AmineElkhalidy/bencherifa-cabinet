import { promises as fs } from "node:fs";

import { ensureDatabasePragmas, prisma } from "@/lib/db";
import { APP_CONFIG } from "@/lib/config";
import { backupDir, uploadDir } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDatabasePragmas(prisma);
    await prisma.$queryRaw`SELECT 1`;
    await Promise.all([
      fs.mkdir(uploadDir(), { recursive: true }),
      fs.mkdir(backupDir(), { recursive: true }),
    ]);

    return Response.json(
      {
        status: "ok",
        service: APP_CONFIG.clinicName,
        version: process.env.npm_package_version ?? "0.1.0",
        timestamp: new Date().toISOString(),
        checks: {
          database: "ok",
          storage: "ok",
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
