# Production Deployment, Security & Operations Guide — Cabinet Bencherifa

This guide provides step-by-step procedures for deploying, securing, backing up, restoring, updating, and operating `cabinet-bencherifa` in a private medical clinic environment in Morocco.

---

## 1. Production Installation Guide

### 1.1 Hardware & Host Recommendations
- **CPU / RAM**: Any modern x86_64 or ARM64 mini-PC / clinic server with ≥ 2 CPU cores and ≥ 2 GB RAM (the container uses ~120–180 MB RAM under typical clinic load).
- **Storage**: SSD with ≥ 20 GB free space for SQLite database growth, medical scan/PDF uploads, and local rolling backups.
- **OS**: Ubuntu Server LTS, Debian Stable, or Windows/macOS with Docker Desktop / Docker Engine + Docker Compose v2.
- **Uninterruptible Power Supply (UPS)**: Strongly recommended for on-premise clinic servers to prevent sudden power loss.

### 1.2 Step-by-Step Docker Deployment
1. Clone or copy the application directory onto the clinic host.
2. Create `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   chmod 600 .env
   ```
3. Generate a cryptographically strong `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Paste the output into `SESSION_SECRET=` in `.env`, and set strong unique passwords for `SEED_DOCTOR_PASSWORD` and `SEED_RECEPTION_PASSWORD`.
4. Configure clinic white-label branding (`NEXT_PUBLIC_CLINIC_NAME`, `NEXT_PUBLIC_DOCTOR_NAME_FR`, `NEXT_PUBLIC_DOCTOR_NAME_AR`, etc.) in `.env`.
5. Build and start the stack:
   ```bash
   docker compose up -d --build
   ```
6. After first login, set `SEED_ON_BOOT=0` in `.env` and remove the plain-text `SEED_*_PASSWORD` values if desired.

---

## 2. Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Yes | `file:/app/data/cabinet.db` | SQLite database file URI |
| `SESSION_SECRET` | Yes | — | ≥ 32-char secret for signing JWT session cookies (enforced in production) |
| `SESSION_MAX_AGE_DAYS` | No | `7` | Session expiration duration in days (1 to 30) |
| `ALLOW_INSECURE_SESSION` | No | `true` (LAN) | Set to `false` when behind HTTPS reverse proxy so cookies carry `Secure` flag |
| `UPLOAD_DIR` | No | `/app/data/uploads` | Directory for uploaded medical attachments |
| `MAX_UPLOAD_MB` | No | `10` | Maximum size per uploaded file in megabytes |
| `ENABLE_BACKUP_CRON` | No | `1` | Set to `1` to enable automated in-process cron backups |
| `BACKUP_CRON` | No | `0 0 * * *` | Cron schedule expression (evaluated in `TZ`) |
| `BACKUP_DIR` | No | `/app/data/backups` | Directory where backup sets and `backup-history.json` are stored |
| `BACKUP_RETENTION_COUNT` | No | `14` | Number of most recent backup sets retained locally before old sets are pruned |
| `GOOGLE_DRIVE_CLIENT_EMAIL` | No | — | Google Cloud service account email for off-site Drive uploads |
| `GOOGLE_DRIVE_PRIVATE_KEY` | No | — | Service account PEM private key (keep literal `\n` sequences) |
| `GOOGLE_DRIVE_FOLDER_ID` | No | — | Target Google Drive folder ID shared with the service account |
| `SEED_ON_BOOT` | No | `1` | Runs idempotent `prisma/seed.mjs` on container startup when `1` |
| `SEED_DOCTOR_USERNAME` | No | `doctor` | Initial doctor username |
| `SEED_DOCTOR_PASSWORD` | First boot | — | Initial doctor password |
| `SEED_RECEPTION_USERNAME` | No | `reception` | Initial receptionist username |
| `SEED_RECEPTION_PASSWORD` | First boot | — | Initial receptionist password |

---

## 3. Security Configuration & Moroccan Law 09-08 / CNDP Compliance

### 3.1 HTTPS & Network Isolation
- **Clinic LAN Deployment**: Bind the host port only to the local clinic network interface or place Caddy / Nginx in front of port `3000` with TLS certificates (e.g., Let's Encrypt or internal CA) and set `ALLOW_INSECURE_SESSION=false`.
- **Firewall**: Restrict access to port `3000` (or `443`) strictly to clinic workstations/tablets. Never expose the container directly to the public internet without TLS and network access controls.

### 3.2 Encryption at Rest & Key Management
- **Host / Volume Encryption (Recommended)**: Enable full-disk encryption on the clinic server host (LUKS/dm-crypt on Linux, BitLocker on Windows, FileVault on macOS) so `/app/data` (SQLite database, uploaded medical scans, and local backups) is encrypted at rest transparently without risking application-level corruption.
- **Key Backup Procedure**: Store the OS disk recovery key and a copy of `.env` (`SESSION_SECRET` and Google Drive credentials) in a physical clinic safe separate from the server hardware.

### 3.3 Moroccan Law 09-08 & CNDP Regulatory Checklist (Human Verification Required)
Technical security controls implemented in `cabinet-bencherifa` (strict RBAC separating receptionist administrative duties from doctor clinical records, PII-redacted logs, `Cache-Control: no-store`, password-change session invalidation, and local data residency) support compliance with **Moroccan Law 09-08** (*Loi n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel*).

However, **each clinic operator (the Doctor as Data Controller / *Responsable du traitement*) must independently complete the following legal and organizational steps**:
1. **CNDP Declaration / Authorization**: Submit the required prior declaration or authorization request to the *Commission Nationale de Contrôle de la Protection des Données à Caractère Personnel (CNDP)* for processing patient health data.
2. **Cross-Border Transfer Authorization (Google Drive)**: If Google Drive cloud backups are enabled (`GOOGLE_DRIVE_*`), data is transferred to cloud servers outside Morocco. Under Articles 43–44 of Law 09-08, cross-border transfer of health data requires either CNDP authorization or encrypting archives prior to cloud upload. If CNDP cross-border authorization is not obtained, keep `GOOGLE_DRIVE_*` unset and use encrypted local/NAS off-site backups.
3. **Patient Information & Consent**: Display a notice in the clinic waiting room informing patients of data collection, purpose, retention, and their rights of access, rectification, and opposition under Law 09-08.
4. **Staff Confidentiality Agreements**: Ensure receptionists and medical staff sign written confidentiality obligations covering clinic credentials and patient data.

---

## 4. Backup & Disaster Recovery Procedure

### 4.1 How Backups Work
- SQLite snapshots are created using `VACUUM INTO`, producing a 100% self-contained, consistent database file even while the clinic is actively recording visits and consultations in WAL mode.
- Every artifact is hashed with SHA-256 and logged to `/app/data/backups/backup-history.json`.
- Old backup sets beyond `BACKUP_RETENTION_COUNT` (default 14) are automatically pruned.

### 4.2 Verifying a Backup
- **Web UI**: Log in as `DOCTOR` → **Sauvegardes** (`/settings/backups`) → click **Verify** next to any restore point.
- **CLI**:
  ```bash
  npm run backup:restore -- --verify <slug>
  ```
  Confirm `"valid": true`, `"integrityCheck": "ok"`, and `"foreignKeyViolations": 0`.

### 4.3 Restoring from a Backup
- **Web UI**: Log in as `DOCTOR` → **Sauvegardes** (`/settings/backups`) → click **Restore** on the desired backup point and confirm.
- **CLI**:
  ```bash
  npm run backup:restore -- --restore <slug-or-path-to-db>
  ```
- **What Happens During Restore**:
  1. The target backup `.db` file is validated via `inspectBackupDatabase` (SQLite header + `PRAGMA integrity_check` + `PRAGMA foreign_key_check`). If validation fails, restoration aborts without touching existing data.
  2. A safety snapshot of the current database (`pre-restore-<timestamp>.db`) is saved in `backups/`.
  3. Active Prisma connections are cleanly closed, stale `-wal` and `-shm` files are removed, and the backup database is atomically moved into place.
  4. If a matching `-uploads.zip` exists, all medical documents are extracted into `uploads/` with Zip-Slip path-traversal protection.
  5. Post-restore integrity check is executed and Prisma reconnects automatically.

---

## 5. Update & Migration Guide

To update an existing clinic installation to a newer release without losing data:

1. **Trigger a Manual Backup First**:
   - In the app, go to **Sauvegardes → Run backup now** (or run `docker exec cabinet-bencherifa node -e "..."` / copy the Docker volume).
2. **Pull the New Code**:
   ```bash
   git pull origin main
   ```
3. **Rebuild and Restart the Container**:
   ```bash
   docker compose up -d --build
   ```
4. **Automatic Migration Execution**:
   - On container boot, `docker/entrypoint.sh` automatically runs `prisma migrate deploy` against `/app/data/cabinet.db` before starting Next.js.
   - Verify health via `curl http://localhost:3000/api/health`.

---

## 6. Troubleshooting Guide

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| Login succeeds on `https://` but redirects back to `/login` on `http://192.168.x.x` | `ALLOW_INSECURE_SESSION=false` sets the `Secure` cookie attribute, which browsers reject over plain HTTP | Either access the clinic server over HTTPS (recommended) or set `ALLOW_INSECURE_SESSION=true` in `.env` for isolated LAN HTTP access. |
| `"Too many login attempts"` error on login | Brute-force rate limiter triggered after 5 failed attempts | Wait 15 minutes for the lockout window to expire, or restart the container if locked out during administrative testing. |
| Document upload returns `415 Unsupported Media Type` | File magic bytes do not match PNG, JPEG, GIF, WEBP, or PDF, or file extension was spoofed | Export the scan/document as a standard PDF, JPEG, or PNG file within the `MAX_UPLOAD_MB` limit. |
| Google Drive status shows `"Drive skipped"` or upload error | Missing `GOOGLE_DRIVE_*` variables or target Drive folder not shared with the service account email | Verify all 3 `GOOGLE_DRIVE_*` env vars are set and the Google Drive folder is shared with `GOOGLE_DRIVE_CLIENT_EMAIL` as **Editor**. Local backups still succeed even when Drive is offline. |
| `/api/health` returns `503 degraded` | SQLite database or `/app/data/uploads` / `/app/data/backups` is not writable by UID `1001` | Check host volume permissions: `chown -R 1001:1001` on the mounted data directory and verify free disk space (`df -h`). |

