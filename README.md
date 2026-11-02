# Cabinet Bencherifa — Medical Practice Management System

A self-hosted, security-hardened, low-resource medical practice management web application designed for private medical clinics in Morocco.

- **Stack**: Next.js 16.2.6 (App Router, `proxy.ts`) · React 19 · TypeScript 5 · Tailwind CSS v4 · Radix UI / Shadcn UI · Prisma 6 · SQLite (WAL mode) · Zod v4 · `jose` (HS256 JWT) · `bcryptjs` · `exceljs` · `archiver` · `jszip` · `node-cron` · Google Drive API v3
- **Deployment Model**: Independent self-hosted installation per clinic (Docker / Docker Compose with `output: "standalone"` and persistent volume `/app/data`)
- **Roles**:
  - `RECEPTIONIST`: Patient registration, administrative updates, waiting list & visit intake, own account password management. Strictly blocked from clinical histories, consultations, prescriptions, medical attachments, financial analytics, expenses, staff management, and backups.
  - `DOCTOR`: Full clinical and administrative access (dashboard, waiting list, consultations, bilingual FR/AR printable prescriptions, medical documents, clinical archives, financial analytics, expense tracking, staff administration, backup & disaster recovery).

---

## 1. Quick Start (Local Development)

Requirements: **Node.js ≥ 20.9**, npm.

```bash
# 1. Install dependencies
npm install

# 2. Create environment configuration
cp .env.example .env
# Generate a strong SESSION_SECRET (>= 32 random bytes, base64):
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. Apply database migrations & generate Prisma client
npm run db:deploy
npm run db:generate

# 4. Seed initial DOCTOR and RECEPTIONIST accounts (idempotent)
npm run seed

# 5. Start the development server
npm run dev
# → http://localhost:3000
```

Default seeded development credentials (override via `SEED_*` in `.env`):

| Role         | Username    | Default Dev Password |
| ------------ | ----------- | -------------------- |
| DOCTOR       | `doctor`    | `Doctor#2026`        |
| RECEPTIONIST | `reception` | `Reception#2026`     |

> **Security Note**: Rotate initial bootstrap passwords immediately after first login via **Profil** (`/profile`) or **Utilisateurs** (`/settings/users`). Changing a user's password immediately invalidates all previously issued JWT sessions for that account.

---

## 2. Production Deployment (Docker Compose)

```bash
# 1. Copy and populate production environment variables
cp .env.example .env
# Edit .env: set a strong SESSION_SECRET, strong SEED_*_PASSWORD values,
# clinic NEXT_PUBLIC_* branding variables, and optional GOOGLE_DRIVE_* credentials.

# 2. Build and launch the production container
docker compose up -d --build

# 3. Check container health
curl http://localhost:3000/api/health
# → {"ok":true,"status":"healthy","timestamp":"..."}
```

The persistent named volume `cabinet-data` is mounted at `/app/data` (permissions `0700`, owned by non-root user `nextjs:nodejs` UID `1001`) and stores:

- `/app/data/cabinet.db` — SQLite database in `WAL` mode (`busy_timeout=5000`, `foreign_keys=ON`)
- `/app/data/uploads/YYYY/MM/<uuid>-<name>.<ext>` — Verified medical attachments (PNG, JPEG, WEBP, GIF, PDF)
- `/app/data/backups/cabinet-<timestamp>.{db,xlsx}` & `cabinet-<timestamp>-{csv,uploads}.zip` — Consistent backups with SHA-256 checksums and persistent `backup-history.json`

For detailed production operations, HTTPS reverse proxy setup, Moroccan Law 09-08 / CNDP compliance, disaster recovery, and troubleshooting, see **[docs/DEPLOYMENT_AND_OPERATIONS.md](docs/DEPLOYMENT_AND_OPERATIONS.md)**.

---

## 3. Architecture & Project Structure

```text
app/
├─ (auth)/login/                    Login screen with brute-force protection
├─ (dashboard)/                     Authenticated shell (desktop sidebar + mobile nav + header)
│   ├─ reception/                   Reception dashboard, patient directory, patient detail, visit creation
│   ├─ doctor/                      Doctor dashboard, waiting list, consultation workspace,
│   │                               printable prescriptions (FR/AR), archives, analytics, expenses
│   ├─ profile/                     Self-service password rotation (DOCTOR & RECEPTIONIST)
│   └─ settings/                    Doctor-only staff administration (/users) & backup/restore (/backups)
├─ actions/                         Server Actions (auth, profile, users, patients, visits,
│                                   consultations, prescriptions, expenses)
├─ api/                             Route Handlers:
│   ├─ health/                      Container healthcheck (DB + storage writability)
│   ├─ auth/logout/                 Session termination
│   ├─ patients/[id]/               Role-filtered patient read & update
│   ├─ medications/search/          Moroccan medication dictionary search (DOCTOR only)
│   ├─ documents/                   Magic-byte validated upload, metadata delete, streaming download
│   └─ backup/                      Manual backup (/run) & integrity check / restore (/restore)
components/                         UI components, forms, charts, prescription print layout
lib/
├─ auth/                            JWT session + pwdTag, bcrypt cost-12 + timing-safe dummy verify,
│                                   DB-backed RBAC (requireAuth, requireRole, requireApiRole), rate limiter
├─ backup/                          VACUUM INTO SQLite snapshot, formula-safe CSV/XLSX exporter,
│                                   Google Drive uploader with exponential backoff, retention & restore
├─ validation/                      Strict bounded Zod schemas for every input boundary
├─ constants.ts                     Canonical roles, visit statuses, insurance types, document types
├─ db.ts                            Prisma singleton + automatic SQLite WAL/FK/busy_timeout pragmas
├─ logger.ts                        Structured logger with automatic medical/PII field redaction
└─ storage.ts                       Path-traversal guards (resolveUpload) + magic-byte signature detector
prisma/
├─ schema.prisma                    Relational schema with composite & search indexes
├─ migrations/                      Backward-compatible SQL migrations
└─ seed.mjs                         Idempotent first-boot account seeding
scripts/
├─ run-backup.ts                    CLI one-shot backup runner (`npm run backup:run`)
└─ restore-backup.ts                CLI backup listing, verification & restore (`npm run backup:restore`)
tests/
├─ unit.test.ts                     Unit tests (validators, auth, rate-limit, file magic bytes, CSV, search)
└─ integration.test.ts              Full E2E clinical workflow, RBAC, and backup/restore tests on isolated DB
proxy.ts                            Next.js 16 request proxy (optimistic routing, CSRF Origin check, CSP/security headers)
```

---

## 4. Security Architecture

1. **Authentication & Session Invalidation**:
   - Passwords hashed with `bcryptjs` (cost factor 12). Login uses `verifyDummyPassword()` when a username does not exist to prevent timing-based account enumeration.
   - Brute-force protection (`lib/auth/rate-limit.ts`) locks out after 5 failed attempts per IP or username for 15 minutes.
   - Sessions use `HttpOnly`, `SameSite=Lax` signed JWTs (`HS256`) containing a `pwdTag` claim (SHA-256 digest prefix of the user's password hash).
   - Every server request verifies the session against SQLite via React `cache()`-deduplicated `verifyActiveSession()`, confirming the user still exists, retains their role, and has a matching `pwdTag`.
2. **Strict Role-Based Access Control (RBAC)**:
   - Enforced on the server in every Server Component, Server Action, and API Route Handler.
   - `RECEPTIONIST` is strictly prevented from reading or modifying `surgicalHistory`, `allergies`, `contraindications`, consultations, prescriptions, medical documents, expenses, analytics, user accounts, or backups, and cannot delete patients.
3. **File Upload & Download Hardening**:
   - Uploads inspect binary magic bytes (`detectAllowedFileExtension`) for PNG, JPEG, GIF, WEBP, and PDF — rejecting spoofed executables or HTML/script payloads regardless of file extension.
   - Stored outside `public/` with UUID filenames and `wx` exclusive creation flags; streamed via `GET /api/documents/[id]/file` only after `DOCTOR` authentication and path-traversal validation (`resolveUpload`).
4. **Web & Spreadsheet Hardening**:
   - `proxy.ts` enforces CSRF `Origin`/`Host` verification on state-changing API requests and sets `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and `Cache-Control: no-store`.
   - All CSV and Excel exports sanitize cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` to prevent spreadsheet formula injection.

---

## 5. Backup & Disaster Recovery

Each backup run (`npm run backup:run`, cron, or **Settings → Backups**) generates 4 artifacts with SHA-256 checksums:

- `cabinet-<slug>.db` — Consistent online SQLite backup created via `VACUUM INTO` (safe while WAL transactions are active)
- `cabinet-<slug>.xlsx` — Multi-sheet Excel workbook (Patients, Visits, Consultations, Expenses, Prescriptions, Items, Documents, Users without password hashes, Analytics)
- `cabinet-<slug>-csv.zip` — UTF-8 BOM CSV exports for Patients, Consultations, and Expenses
- `cabinet-<slug>-uploads.zip` — Archive of all uploaded medical attachments

### Verifying & Restoring a Backup

Via Web UI (**Settings → Backups**, `DOCTOR` only):
- Click **Verify** next to any restore point to run `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, and inspect record counts.
- Click **Restore** to automatically create a `pre-restore-<timestamp>.db` safety snapshot and restore both the SQLite database and uploaded medical files.

Via CLI:
```bash
# List available backups on disk
npm run backup:restore -- --list

# Verify SQLite header, integrity, foreign keys, and row counts
npm run backup:restore -- --verify <slug-or-path-to-db>

# Restore database and corresponding -uploads.zip (creates pre-restore snapshot automatically)
npm run backup:restore -- --restore <slug-or-path-to-db>
```

---

## 6. Scripts Reference

| Command                   | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`             | Start Next.js development server                                            |
| `npm run build`           | Production build (`output: "standalone"`)                                   |
| `npm start`               | Start Next.js production server                                             |
| `npm test`                | Run automated Unit, Security, Integration & E2E Backup/Restore test suite   |
| `npm run typecheck`       | Run TypeScript compiler check (`tsc --noEmit`)                              |
| `npm run lint`            | Run ESLint across the codebase                                              |
| `npm run db:deploy`       | Apply pending Prisma migrations safely in production                        |
| `npm run db:generate`     | Regenerate Prisma client                                                    |
| `npm run seed`            | Idempotent bootstrap of initial `DOCTOR` and `RECEPTIONIST` accounts        |
| `npm run backup:run`      | Trigger a complete backup from the command line                             |
| `npm run backup:restore`  | List (`--list`), verify (`--verify`), or restore (`--restore`) a backup set |
