/**
 * Idempotent first-run seed. Reads the desired credentials from env
 * (SEED_DOCTOR_USERNAME / SEED_DOCTOR_PASSWORD / ...) and creates the
 * accounts only if they don't already exist.
 *
 * Triggered automatically by docker/entrypoint.sh when SEED_ON_BOOT=1
 * and manually via `npm run seed` for local development.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function ensureUser(username, password, role) {
  if (!username || !password) {
    console.warn(`[seed] skipping ${role} — credentials not provided`);
    return;
  }
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`[seed] ${role} '${username}' already exists`);
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { username, password: hash, role } });
  console.log(`[seed] created ${role} '${username}'`);
}

async function main() {
  await ensureUser(
    process.env.SEED_DOCTOR_USERNAME ?? "doctor",
    process.env.SEED_DOCTOR_PASSWORD ?? "Doctor#2026",
    "DOCTOR"
  );
  await ensureUser(
    process.env.SEED_RECEPTION_USERNAME ?? "reception",
    process.env.SEED_RECEPTION_PASSWORD ?? "Reception#2026",
    "RECEPTIONIST"
  );
}

main()
  .catch((err) => {
    console.error("[seed] failed", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
