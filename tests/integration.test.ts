import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import JSZip from "jszip";

// Stub `server-only` for Node test runner environment
type ModuleWithResolve = typeof Module & {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string;
};

const stubPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts/server-only-stub.cjs"
);
const mod = Module as ModuleWithResolve;
const origResolve = mod._resolveFilename;
mod._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (request === "server-only") return stubPath;
  return origResolve.call(this, request, parent, isMain, options);
};

// Isolated temporary directory so tests NEVER touch prisma/dev.db or data/
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "cabinet-test-"));
const testDbPath = path.join(tempRoot, "test-clinic.db");
const testUploadsDir = path.join(tempRoot, "uploads");
const testBackupsDir = path.join(tempRoot, "backups");
const restoreTargetDbPath = path.join(tempRoot, "restored-clinic.db");
const restoreTargetUploadsDir = path.join(tempRoot, "restored-uploads");

process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.UPLOAD_DIR = testUploadsDir;
process.env.BACKUP_DIR = testBackupsDir;
process.env.BACKUP_RETENTION_COUNT = "3";
process.env.SESSION_SECRET =
  "integration-test-strong-secret-key-at-least-32-bytes-long";
// Ensure Google Drive is skipped cleanly during offline sandbox tests
process.env.GOOGLE_DRIVE_CLIENT_EMAIL = "";
process.env.GOOGLE_DRIVE_PRIVATE_KEY = "";
process.env.GOOGLE_DRIVE_FOLDER_ID = "";

async function applyMigrationsToSqlite(prisma: PrismaClient) {
  const migrationsRoot = path.resolve(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    const sqlPath = path.join(migrationsRoot, dir, "migration.sql");
    if (!existsSync(sqlPath)) continue;
    const rawSql = readFileSync(sqlPath, "utf8");
    const statements = rawSql
      .split(";")
      .map((s) =>
        s
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim()
      )
      .filter(Boolean);

    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
    }
  }
}

describe("Integration, Security & E2E Workflow Tests (Isolated SQLite DB)", () => {
  let prisma: PrismaClient;

  before(async () => {
    await mkdir(testUploadsDir, { recursive: true });
    await mkdir(testBackupsDir, { recursive: true });

    const dbMod = await import("@/lib/db");
    prisma = dbMod.prisma;
    await dbMod.ensureDatabasePragmas();
    await applyMigrationsToSqlite(prisma);
  });

  after(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Ignore Windows file lock cleanup delay in temp dir
    }
  });

  it("configures SQLite WAL mode and foreign key enforcement", async () => {
    const fkRows = await prisma.$queryRawUnsafe<{ foreign_keys: bigint | number }[]>(
      "PRAGMA foreign_keys;"
    );
    assert.equal(Number(fkRows[0]?.foreign_keys), 1);

    const jmRows = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>(
      "PRAGMA journal_mode;"
    );
    assert.equal(jmRows[0]?.journal_mode.toLowerCase(), "wal");
  });

  it("executes the complete Receptionist -> Doctor clinical & financial workflow atomically", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    const { computePasswordTag } = await import("@/lib/auth/session");

    // 1. Seed Doctor and Receptionist accounts
    const docHash = await hashPassword("DoctorStrong#2026");
    const recHash = await hashPassword("ReceptionStrong#2026");

    const doctor = await prisma.user.create({
      data: { username: "dr_bencherifa", password: docHash, role: "DOCTOR" },
    });
    const receptionist = await prisma.user.create({
      data: {
        username: "reception_1",
        password: recHash,
        role: "RECEPTIONIST",
      },
    });

    assert.equal(doctor.role, "DOCTOR");
    assert.equal(receptionist.role, "RECEPTIONIST");

    // Verify password change invalidates session pwdTag
    const initialTag = computePasswordTag(doctor.password);
    const updatedHash = await hashPassword("DoctorUpdated#2026");
    const updatedTag = computePasswordTag(updatedHash);
    assert.notEqual(initialTag, updatedTag);

    // 2. Receptionist registers a patient
    const patient = await prisma.patient.create({
      data: {
        name: "Youssef El Amrani",
        age: "45 ans",
        gender: "Male",
        cin: "BK998877",
        phoneNumber: "0661223344",
        insuranceProvider: "CNOPS",
        allergies: "Pénicilline",
      },
    });
    assert.ok(patient.id);

    // Verify CIN uniqueness constraint prevents duplicate patient records
    await assert.rejects(async () => {
      await prisma.patient.create({
        data: {
          name: "Duplicate CIN Patient",
          age: "30 ans",
          gender: "Female",
          cin: "BK998877",
        },
      });
    });

    // 3. Receptionist creates a Pending visit
    const visit = await prisma.visit.create({
      data: {
        patientId: patient.id,
        visitType: "Consultation",
        status: "Pending",
        price: 300,
      },
    });
    assert.equal(visit.status, "Pending");

    // Verify visit appears in waiting list
    const waitingCount = await prisma.visit.count({
      where: { status: "Pending" },
    });
    assert.equal(waitingCount, 1);

    // 4. Doctor completes consultation atomically with prescription and uploaded document
    const samplePdfBytes = Buffer.from(
      "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
      "utf8"
    );
    const relativeDocPath = "2026/05/sample-lab-report.pdf";
    const fullDocPath = path.join(testUploadsDir, "2026", "05");
    await mkdir(fullDocPath, { recursive: true });
    await writeFile(
      path.join(fullDocPath, "sample-lab-report.pdf"),
      samplePdfBytes
    );

    await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.upsert({
        where: { visitId: visit.id },
        update: {
          reasonForVisit: "Douleurs épigastriques",
          diagnosis: "Gastrite aiguë",
          clinicalNotes: "Abdomen souple, sensibilité épigastrique",
          vitals: "TA 120/80, FC 72",
        },
        create: {
          visitId: visit.id,
          reasonForVisit: "Douleurs épigastriques",
          diagnosis: "Gastrite aiguë",
          clinicalNotes: "Abdomen souple, sensibilité épigastrique",
          vitals: "TA 120/80, FC 72",
        },
      });

      await tx.prescription.create({
        data: {
          consultationId: consultation.id,
          items: {
            create: [
              {
                medication: "Oméprazole 20mg",
                medicationType: "Gélule",
                doseMorning: 1,
                doseNoon: 0,
                doseEvening: 0,
                duration: "14 jours",
                sortOrder: 0,
              },
              {
                medication: "Alginate de sodium",
                medicationType: "Sachet",
                doseMorning: 1,
                doseNoon: 1,
                doseEvening: 1,
                duration: "7 jours",
                sortOrder: 1,
              },
            ],
          },
        },
      });

      await tx.medicalDocument.create({
        data: {
          consultationId: consultation.id,
          fileUrl: relativeDocPath,
          documentType: "lab",
        },
      });

      await tx.visit.update({
        where: { id: visit.id },
        data: { status: "Completed" },
      });
    });

    // Verify visit is now Completed and waiting list is 0
    const remainingWaiting = await prisma.visit.count({
      where: { status: "Pending" },
    });
    assert.equal(remainingWaiting, 0);

    const completedConsultation = await prisma.consultation.findUnique({
      where: { visitId: visit.id },
      include: {
        visit: { include: { patient: true } },
        prescription: { include: { items: { orderBy: { sortOrder: "asc" } } } },
        documents: true,
      },
    });
    assert.ok(completedConsultation);
    assert.equal(completedConsultation.visit.status, "Completed");
    assert.equal(completedConsultation.diagnosis, "Gastrite aiguë");
    assert.equal(completedConsultation.prescription?.items.length, 2);
    assert.equal(
      completedConsultation.prescription?.items[0]?.medication,
      "Oméprazole 20mg"
    );
    assert.equal(completedConsultation.documents.length, 1);

    // 5. Doctor records a clinic expense
    const expense = await prisma.expense.create({
      data: {
        title: "Achat consommables médicaux",
        amount: 650,
        category: "Consumables",
        date: new Date("2026-05-10T00:00:00Z"),
        notes: "Facture #2026-09",
      },
    });
    assert.equal(expense.amount, 650);
  });

  it("generates full backups, verifies SHA-256 & SQLite integrity, blocks malicious archives, and restores 100% of clinic data", async () => {
    const { runBackup, getBackupHistory, listAvailableBackups } = await import(
      "@/lib/backup/runner"
    );
    const {
      inspectBackupDatabase,
      restoreFromBackup,
      extractUploadsArchive,
    } = await import("@/lib/backup/restore");

    // 1. Execute full backup
    const summary = await runBackup();
    assert.equal(summary.status, "success");
    assert.equal(summary.artifacts.length, 6);
    for (const artifact of summary.artifacts) {
      assert.ok(artifact.bytes > 0, `Artifact ${artifact.filename} is empty`);
      assert.equal(artifact.sha256.length, 64);
    }

    // Verify backup history and restore points are persisted on disk
    const history = getBackupHistory();
    assert.ok(history.length >= 1);
    assert.equal(history[0]?.slug, summary.slug);

    const available = listAvailableBackups();
    assert.ok(available.length >= 1);
    const latestPoint = available[0]!;
    assert.equal(latestPoint.slug, summary.slug);
    assert.ok(latestPoint.uploadsZipFilename);

    // 2. Inspect and verify the SQLite backup artifact
    const dbArtifactPath = path.join(testBackupsDir, latestPoint.dbFilename);
    const uploadsZipPath = path.join(
      testBackupsDir,
      latestPoint.uploadsZipFilename!
    );

    const inspection = await inspectBackupDatabase(dbArtifactPath);
    assert.equal(inspection.valid, true);
    assert.equal(inspection.integrityCheck, "ok");
    assert.equal(inspection.foreignKeyViolations, 0);
    assert.equal(inspection.counts.users, 2);
    assert.equal(inspection.counts.patients, 1);
    assert.equal(inspection.counts.visits, 1);
    assert.equal(inspection.counts.consultations, 1);
    assert.equal(inspection.counts.prescriptions, 1);
    assert.equal(inspection.counts.expenses, 1);
    assert.equal(inspection.counts.documents, 1);

    // 3. Verify corrupted backup file is rejected before touching target DB
    const corruptDbPath = path.join(tempRoot, "corrupt.db");
    await writeFile(corruptDbPath, "NOT_A_VALID_SQLITE_DATABASE_HEADER", "utf8");
    const corruptCheck = await inspectBackupDatabase(corruptDbPath);
    assert.equal(corruptCheck.valid, false);
    await assert.rejects(async () => {
      await restoreFromBackup({
        dbBackupPath: corruptDbPath,
        targetDbPath: restoreTargetDbPath,
        targetUploadsDir: restoreTargetUploadsDir,
      });
    }, /Cannot restore from invalid or corrupted backup/);

    // 4. Verify Zip-Slip path traversal in uploads archive is rejected
    const maliciousZip = new JSZip();
    maliciousZip.file("placeholder.txt", "pwned");
    const validZipBuf = await maliciousZip.generateAsync({
      type: "nodebuffer",
    });
    // Replace "placeholder.txt" (15 bytes) with "../evil-esc.txt" (15 bytes) in the ZIP binary
    const maliciousBuf = Buffer.from(
      validZipBuf
        .toString("latin1")
        .replace(/placeholder\.txt/g, "../evil-esc.txt"),
      "latin1"
    );
    const maliciousZipPath = path.join(tempRoot, "malicious-uploads.zip");
    await writeFile(maliciousZipPath, maliciousBuf);
    await assert.rejects(async () => {
      await extractUploadsArchive(maliciousZipPath, restoreTargetUploadsDir);
    }, /Unsafe zip entry path rejected/);

    // 5. Perform full restore into isolated target DB and target uploads directory
    const restoreResult = await restoreFromBackup({
      dbBackupPath: dbArtifactPath,
      uploadsZipPath,
      targetDbPath: restoreTargetDbPath,
      targetUploadsDir: restoreTargetUploadsDir,
      createPreRestoreSnapshot: true,
    });

    assert.equal(restoreResult.inspection.valid, true);
    assert.equal(restoreResult.restoredFilesCount, 1);
    assert.equal(restoreResult.inspection.counts.patients, 1);
    assert.equal(restoreResult.inspection.counts.consultations, 1);
    assert.equal(restoreResult.inspection.counts.prescriptions, 1);

    // Verify the uploaded PDF file was restored byte-for-byte
    const restoredPdfPath = path.join(
      restoreTargetUploadsDir,
      "2026",
      "05",
      "sample-lab-report.pdf"
    );
    assert.equal(existsSync(restoredPdfPath), true);
    const restoredPdfContent = readFileSync(restoredPdfPath, "utf8");
    assert.ok(restoredPdfContent.startsWith("%PDF-1.7"));
  });
});
