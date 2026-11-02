import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. In development Next.js hot-reloads modules,
 * which would otherwise spawn a new SQLite connection on every save.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  sqlitePragmasApplied: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Applies recommended SQLite production PRAGMAs for concurrent read/write
 * reliability (WAL mode, busy timeout, synchronous=NORMAL, foreign keys).
 * Safe and idempotent to call on startup or before critical operations.
 */
export async function ensureDatabasePragmas(client: PrismaClient = prisma) {
  if (globalForPrisma.sqlitePragmasApplied && client === prisma) {
    return;
  }
  try {
    await client.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
    await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
    await client.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
    if (client === prisma) {
      globalForPrisma.sqlitePragmasApplied = true;
    }
  } catch {
    // Ignore if database is not yet initialized during build step
  }
}

if (process.env.NEXT_PHASE !== "phase-production-build") {
  void ensureDatabasePragmas(prisma);
}
