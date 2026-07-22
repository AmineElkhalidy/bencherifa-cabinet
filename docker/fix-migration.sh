#!/bin/sh
set -eu
apk add --no-cache sqlite
echo "=== Current migration state ==="
sqlite3 /data/cabinet.db "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;"
echo ""
echo "=== Marking failed migration as rolled back ==="
sqlite3 /data/cabinet.db "DELETE FROM _prisma_migrations WHERE migration_name = '20260519210000_expenses_replace_charges';"
echo ""
echo "=== Checking if Charge table exists ==="
sqlite3 /data/cabinet.db ".tables" | grep -i charge || echo "(No Charge table found)"
sqlite3 /data/cabinet.db ".tables" | grep -i expense || echo "(No Expense table found)"
echo ""
echo "=== Updated migration state ==="
sqlite3 /data/cabinet.db "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;"
echo "Done!"
