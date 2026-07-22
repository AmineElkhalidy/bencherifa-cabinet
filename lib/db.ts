import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. In development Next.js hot-reloads modules,
 * which would otherwise spawn a new SQLite connection on every save.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
