-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "cin" TEXT NOT NULL,
    "insuranceProvider" TEXT NOT NULL DEFAULT 'NONE',
    "surgicalHistory" TEXT NOT NULL DEFAULT '',
    "allergies" TEXT NOT NULL DEFAULT '',
    "contraindications" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitType" TEXT NOT NULL DEFAULT 'Consultation',
    "price" REAL NOT NULL DEFAULT 150,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reasonForVisit" TEXT NOT NULL DEFAULT '',
    "hps" TEXT NOT NULL DEFAULT '',
    "rs" TEXT NOT NULL DEFAULT '',
    "pe" TEXT NOT NULL DEFAULT '',
    "vitals" TEXT NOT NULL DEFAULT '',
    "eco" TEXT NOT NULL DEFAULT '',
    "bloodWork" TEXT NOT NULL DEFAULT '',
    "clinicalNotes" TEXT NOT NULL DEFAULT '',
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "prescribedTreatment" TEXT NOT NULL DEFAULT '',
    "dosageInstructions" TEXT NOT NULL DEFAULT '',
    "allergiesConsidered" TEXT NOT NULL DEFAULT '',
    "followUpDate" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "hasCnss" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Consultation_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicalDocument_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_cin_key" ON "Patient"("cin");

-- CreateIndex
CREATE INDEX "Patient_name_idx" ON "Patient"("name");

-- CreateIndex
CREATE INDEX "Patient_cin_idx" ON "Patient"("cin");

-- CreateIndex
CREATE INDEX "Patient_phoneNumber_idx" ON "Patient"("phoneNumber");

-- CreateIndex
CREATE INDEX "Visit_patientId_idx" ON "Visit"("patientId");

-- CreateIndex
CREATE INDEX "Visit_date_idx" ON "Visit"("date");

-- CreateIndex
CREATE INDEX "Visit_status_idx" ON "Visit"("status");

-- CreateIndex
CREATE INDEX "Visit_status_date_idx" ON "Visit"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_visitId_key" ON "Consultation"("visitId");

-- CreateIndex
CREATE INDEX "Consultation_date_idx" ON "Consultation"("date");

-- CreateIndex
CREATE INDEX "MedicalDocument_consultationId_idx" ON "MedicalDocument"("consultationId");
