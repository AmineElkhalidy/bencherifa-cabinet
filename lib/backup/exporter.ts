import "server-only";

import { copyFile, unlink } from "node:fs/promises";
import { access, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Worksheet } from "exceljs";
import ExcelJS from "exceljs";

import { ensureDatabasePragmas, prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  backupDir,
  databasePath,
  ensureDir,
  uploadDir,
} from "@/lib/storage";

import { zipDirectory } from "./archive";
import { APP_CONFIG } from "@/lib/config";
import { buildAnalyticsSnapshot } from "./analytics-snapshot";
import { iso, sanitizeSpreadsheetValue, sha256File, toCsv } from "./csv";

export type BackupArtifactFormat = "xlsx" | "csv" | "db" | "zip";

export type BackupArtifact = {
  format: BackupArtifactFormat;
  absolutePath: string;
  filename: string;
  bytes: number;
  sha256: string;
};

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIME = "text/csv";
const DB_MIME = "application/x-sqlite3";
const ZIP_MIME = "application/zip";

export const BACKUP_MIMES: Record<BackupArtifactFormat, string> = {
  xlsx: XLSX_MIME,
  csv: CSV_MIME,
  db: DB_MIME,
  zip: ZIP_MIME,
};

export function timestampSlug(now: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "T",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function styleHeader(ws: Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE9F1F8" },
  };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function sanitizeRowForExcel<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" ? sanitizeSpreadsheetValue(v) : v;
  }
  return out as T;
}

function addSheet<T extends Record<string, unknown>>(
  wb: ExcelJS.Workbook,
  name: string,
  columns: { header: string; key: string; width?: number }[],
  rows: T[]
) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 18,
  }));
  ws.addRows(rows.map(sanitizeRowForExcel));
  styleHeader(ws);
  return ws;
}

async function artifactFromPath(
  absolutePath: string,
  format: BackupArtifactFormat
): Promise<BackupArtifact> {
  const s = await stat(absolutePath);
  if (s.size === 0) {
    throw new Error(`Generated backup artifact is empty: ${absolutePath}`);
  }
  const sha256 = await sha256File(absolutePath);
  return {
    format,
    absolutePath,
    filename: path.basename(absolutePath),
    bytes: s.size,
    sha256,
  };
}

/**
 * Creates a transactionally consistent snapshot of the active SQLite database,
 * safely incorporating any uncheckpointed WAL pages using `VACUUM INTO`.
 */
export async function createConsistentSqliteBackup(
  destPath: string
): Promise<void> {
  await ensureDatabasePragmas(prisma);
  // Remove destination if it already exists (VACUUM INTO requires a non-existent target)
  await unlink(destPath).catch(() => undefined);

  const escapedDest = destPath.replace(/'/g, "''");
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedDest}';`);
  } catch (err) {
    // Fallback: checkpoint WAL then copy file if VACUUM INTO fails on an older SQLite build
    logger.warn(
      "backup",
      "VACUUM INTO failed, falling back to WAL checkpoint + copy",
      { error: err }
    );
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
    await copyFile(databasePath(), destPath);
  }
}

/**
 * Full cabinet backup on the persistent volume:
 *   - XLSX workbook (all tables + analytics snapshot)
 *   - CSV exports (patients, consultations, expenses)
 *   - Consistent SQLite database snapshot (via VACUUM INTO)
 *   - ZIP of uploaded medical documents (when non-empty)
 */
export async function buildBackupArtifacts(
  now: Date = new Date()
): Promise<{ slug: string; artifacts: BackupArtifact[] }> {
  const dir = backupDir();
  await ensureDir(dir);
  const slug = timestampSlug(now);

  const [
    patients,
    visits,
    consultations,
    expenses,
    prescriptions,
    prescriptionItems,
    documents,
    users,
    analytics,
  ] = await Promise.all([
    prisma.patient.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.visit.findMany({
      orderBy: { date: "asc" },
      include: { patient: { select: { name: true, cin: true } } },
    }),
    prisma.consultation.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        visit: {
          include: { patient: { select: { name: true, cin: true } } },
        },
      },
    }),
    prisma.expense.findMany({ orderBy: { date: "asc" } }),
    prisma.prescription.findMany({ orderBy: { prescriptionDate: "asc" } }),
    prisma.prescriptionItem.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.medicalDocument.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    buildAnalyticsSnapshot(now),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = APP_CONFIG.clinicName;
  wb.created = now;

  addSheet(
    wb,
    "Patients",
    [
      { header: "ID", key: "id", width: 28 },
      { header: "Name", key: "name", width: 28 },
      { header: "Age", key: "age", width: 10 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Phone", key: "phoneNumber", width: 16 },
      { header: "CIN", key: "cin", width: 14 },
      { header: "Insurance", key: "insuranceProvider", width: 12 },
      { header: "Surgical history", key: "surgicalHistory", width: 40 },
      { header: "Allergies", key: "allergies", width: 30 },
      { header: "Contraindications", key: "contraindications", width: 30 },
      { header: "Created at", key: "createdAt", width: 22 },
      { header: "Updated at", key: "updatedAt", width: 22 },
    ],
    patients.map((p) => ({
      ...p,
      createdAt: iso(p.createdAt),
      updatedAt: iso(p.updatedAt),
    }))
  );

  addSheet(
    wb,
    "Visits",
    [
      { header: "ID", key: "id", width: 28 },
      { header: "Patient ID", key: "patientId", width: 28 },
      { header: "Patient", key: "patientName", width: 28 },
      { header: "CIN", key: "cin", width: 14 },
      { header: "Date", key: "date", width: 22 },
      { header: "Type", key: "visitType", width: 14 },
      { header: "Status", key: "status", width: 12 },
      { header: "Price (MAD)", key: "price", width: 12 },
      { header: "Created at", key: "createdAt", width: 22 },
    ],
    visits.map((v) => ({
      id: v.id,
      patientId: v.patientId,
      patientName: v.patient.name,
      cin: v.patient.cin ?? "",
      date: iso(v.date),
      visitType: v.visitType,
      status: v.status,
      price: v.price,
      createdAt: iso(v.createdAt),
    }))
  );

  addSheet(
    wb,
    "Consultations",
    [
      { header: "ID", key: "id", width: 28 },
      { header: "Visit ID", key: "visitId", width: 28 },
      { header: "Patient", key: "patientName", width: 28 },
      { header: "CIN", key: "cin", width: 14 },
      { header: "Date", key: "date", width: 22 },
      { header: "Reason", key: "reasonForVisit", width: 32 },
      { header: "HPS", key: "hps", width: 32 },
      { header: "RS", key: "rs", width: 32 },
      { header: "PE", key: "pe", width: 32 },
      { header: "Vitals", key: "vitals", width: 26 },
      { header: "Echo", key: "eco", width: 26 },
      { header: "Blood work", key: "bloodWork", width: 26 },
      { header: "Clinical notes", key: "clinicalNotes", width: 32 },
      { header: "Diagnostic", key: "diagnosis", width: 22 },
      { header: "Treatment", key: "prescribedTreatment", width: 32 },
      { header: "Dosage", key: "dosageInstructions", width: 26 },
      { header: "Allergies considered", key: "allergiesConsidered", width: 26 },
      { header: "Follow-up", key: "followUpDate", width: 22 },
      { header: "Notes", key: "notes", width: 32 },
      { header: "CNSS", key: "hasCnss", width: 8 },
      { header: "Created at", key: "createdAt", width: 22 },
    ],
    consultations.map((c) => ({
      id: c.id,
      visitId: c.visitId,
      patientName: c.visit.patient.name,
      cin: c.visit.patient.cin ?? "",
      date: iso(c.date),
      reasonForVisit: c.reasonForVisit,
      hps: c.hps,
      rs: c.rs,
      pe: c.pe,
      vitals: c.vitals,
      eco: c.eco,
      bloodWork: c.bloodWork,
      clinicalNotes: c.clinicalNotes,
      diagnosis: c.diagnosis,
      prescribedTreatment: c.prescribedTreatment,
      dosageInstructions: c.dosageInstructions,
      allergiesConsidered: c.allergiesConsidered,
      followUpDate: iso(c.followUpDate),
      notes: c.notes,
      hasCnss: c.hasCnss ? "YES" : "NO",
      createdAt: iso(c.createdAt),
    }))
  );

  addSheet(
    wb,
    "Expenses",
    [
      { header: "ID", key: "id", width: 28 },
      { header: "Title", key: "title", width: 28 },
      { header: "Amount (MAD)", key: "amount", width: 14 },
      { header: "Category", key: "category", width: 18 },
      { header: "Date", key: "date", width: 22 },
      { header: "Notes", key: "notes", width: 40 },
      { header: "Created at", key: "createdAt", width: 22 },
    ],
    expenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      category: e.category,
      date: iso(e.date),
      notes: e.notes,
      createdAt: iso(e.createdAt),
    }))
  );

  addSheet(
    wb,
    "Prescriptions",
    [
      { header: "ID", key: "id", width: 28 },
      { header: "Consultation ID", key: "consultationId", width: 28 },
      { header: "Date", key: "prescriptionDate", width: 22 },
      { header: "Created at", key: "createdAt", width: 22 },
    ],
    prescriptions.map((p) => ({
      id: p.id,
      consultationId: p.consultationId,
      prescriptionDate: iso(p.prescriptionDate),
      createdAt: iso(p.createdAt),
    }))
  );

  addSheet(
    wb,
    "PrescriptionItems",
    [
      { header: "ID", key: "id", width: 28 },
      { header: "Prescription ID", key: "prescriptionId", width: 28 },
      { header: "Medication", key: "medication", width: 28 },
      { header: "Medication type", key: "medicationType", width: 18 },
      { header: "Morning", key: "doseMorning", width: 10 },
      { header: "Noon", key: "doseNoon", width: 10 },
      { header: "Evening", key: "doseEvening", width: 10 },
      { header: "Duration", key: "duration", width: 16 },
      { header: "Sort order", key: "sortOrder", width: 12 },
    ],
    prescriptionItems
  );

  addSheet(
    wb,
    "MedicalDocuments",
    [
      { header: "ID", key: "id", width: 28 },
      { header: "Consultation ID", key: "consultationId", width: 28 },
      { header: "File URL", key: "fileUrl", width: 40 },
      { header: "Type", key: "documentType", width: 14 },
      { header: "Created at", key: "createdAt", width: 22 },
    ],
    documents.map((d) => ({
      id: d.id,
      consultationId: d.consultationId,
      fileUrl: d.fileUrl,
      documentType: d.documentType,
      createdAt: iso(d.createdAt),
    }))
  );

  addSheet(
    wb,
    "Users",
    [
      { header: "ID", key: "id", width: 28 },
      { header: "Username", key: "username", width: 20 },
      { header: "Role", key: "role", width: 14 },
      { header: "Created at", key: "createdAt", width: 22 },
      { header: "Updated at", key: "updatedAt", width: 22 },
    ],
    users.map((u) => ({
      ...u,
      createdAt: iso(u.createdAt),
      updatedAt: iso(u.updatedAt),
    }))
  );

  const wsAnalytics = wb.addWorksheet("Analytics");
  wsAnalytics.addRow(["KPI", "Value", "Period"]);
  styleHeader(wsAnalytics);
  analytics.kpis.forEach((k) =>
    wsAnalytics.addRow([
      k.metric,
      sanitizeSpreadsheetValue(k.value),
      k.period,
    ])
  );
  wsAnalytics.addRow([]);
  wsAnalytics.addRow(["Date", "Visits", "Revenue (MAD)"]);
  const dailyHeaderRow = wsAnalytics.lastRow?.number ?? 1;
  wsAnalytics.getRow(dailyHeaderRow).font = { bold: true };
  analytics.daily.forEach((d) =>
    wsAnalytics.addRow([d.date, d.visits, d.revenueMad])
  );
  wsAnalytics.addRow([]);
  wsAnalytics.addRow(["Diagnosis", "Cases", "Share %"]);
  const diagHeaderRow = wsAnalytics.lastRow?.number ?? 1;
  wsAnalytics.getRow(diagHeaderRow).font = { bold: true };
  analytics.diagnoses.forEach((d) =>
    wsAnalytics.addRow([
      sanitizeSpreadsheetValue(d.diagnosis),
      d.cases,
      d.sharePct,
    ])
  );

  const xlsxName = `cabinet-${slug}.xlsx`;
  const xlsxPath = path.join(dir, xlsxName);
  await wb.xlsx.writeFile(xlsxPath);

  const csvPatientsPath = path.join(dir, `cabinet-${slug}-patients.csv`);
  await writeFile(
    csvPatientsPath,
    toCsv(
      [
        "id",
        "name",
        "age",
        "gender",
        "phoneNumber",
        "cin",
        "insuranceProvider",
        "surgicalHistory",
        "allergies",
        "contraindications",
        "createdAt",
        "updatedAt",
      ],
      patients.map((p) => ({
        ...p,
        createdAt: iso(p.createdAt),
        updatedAt: iso(p.updatedAt),
      }))
    ),
    "utf8"
  );

  const csvConsultationsPath = path.join(
    dir,
    `cabinet-${slug}-consultations.csv`
  );
  await writeFile(
    csvConsultationsPath,
    toCsv(
      [
        "id",
        "visitId",
        "patientName",
        "cin",
        "date",
        "reasonForVisit",
        "hps",
        "rs",
        "pe",
        "vitals",
        "eco",
        "bloodWork",
        "clinicalNotes",
        "diagnosis",
        "prescribedTreatment",
        "dosageInstructions",
        "allergiesConsidered",
        "followUpDate",
        "notes",
        "hasCnss",
        "createdAt",
      ],
      consultations.map((c) => ({
        id: c.id,
        visitId: c.visitId,
        patientName: c.visit.patient.name,
        cin: c.visit.patient.cin ?? "",
        date: iso(c.date),
        reasonForVisit: c.reasonForVisit,
        hps: c.hps,
        rs: c.rs,
        pe: c.pe,
        vitals: c.vitals,
        eco: c.eco,
        bloodWork: c.bloodWork,
        clinicalNotes: c.clinicalNotes,
        diagnosis: c.diagnosis,
        prescribedTreatment: c.prescribedTreatment,
        dosageInstructions: c.dosageInstructions,
        allergiesConsidered: c.allergiesConsidered,
        followUpDate: iso(c.followUpDate),
        notes: c.notes,
        hasCnss: c.hasCnss ? "1" : "0",
        createdAt: iso(c.createdAt),
      }))
    ),
    "utf8"
  );

  const csvExpensesPath = path.join(dir, `cabinet-${slug}-expenses.csv`);
  await writeFile(
    csvExpensesPath,
    toCsv(
      ["id", "title", "amount", "category", "date", "notes", "createdAt"],
      expenses.map((e) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        category: e.category,
        date: iso(e.date),
        notes: e.notes,
        createdAt: iso(e.createdAt),
      }))
    ),
    "utf8"
  );

  const artifacts: BackupArtifact[] = [
    await artifactFromPath(xlsxPath, "xlsx"),
    await artifactFromPath(csvPatientsPath, "csv"),
    await artifactFromPath(csvConsultationsPath, "csv"),
    await artifactFromPath(csvExpensesPath, "csv"),
  ];

  const dbSrc = databasePath();
  try {
    await access(dbSrc);
    const dbName = `cabinet-${slug}.db`;
    const dbDest = path.join(dir, dbName);
    await createConsistentSqliteBackup(dbDest);
    artifacts.push(await artifactFromPath(dbDest, "db"));
  } catch (err) {
    logger.warn("backup", "Database snapshot skipped or failed", {
      dbSrc,
      error: err,
    });
  }

  const zipName = `cabinet-${slug}-uploads.zip`;
  const zipPath = path.join(dir, zipName);
  const zipped = await zipDirectory(uploadDir(), zipPath);
  if (zipped) {
    artifacts.push(await artifactFromPath(zipPath, "zip"));
  }

  return { slug, artifacts };
}
