#!/bin/sh
# Cabinet Eddahbi — container entrypoint.
# Runs DB migrations against the persistent SQLite volume,
# optionally seeds the first DOCTOR account, then hands off to
# the Next.js standalone server (or whatever CMD was provided).
set -eu

echo "[entrypoint] Cabinet Eddahbi starting..."
echo "[entrypoint] DATABASE_URL=${DATABASE_URL:-<unset>}"

# Make sure the data dir exists (idempotent — volume may be empty).
mkdir -p /app/data /app/data/uploads /app/data/backups

# Apply pending migrations. `migrate deploy` is the production-safe
# command — it never prompts and never resets data.
echo "[entrypoint] Applying Prisma migrations..."
node /app/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema=/app/prisma/schema.prisma

# Optional first-run seed. Set SEED_ON_BOOT=1 in docker-compose.yml
# to auto-create the initial admin/receptionist accounts.
if [ "${SEED_ON_BOOT:-0}" = "1" ]; then
  echo "[entrypoint] Seeding initial accounts..."
  node /app/prisma/seed.mjs || echo "[entrypoint] Seed step skipped (already seeded or seed file missing)."
fi

echo "[entrypoint] Handing off to: $*"
exec "$@"
