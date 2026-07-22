-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "cin" TEXT,
    "insuranceProvider" TEXT NOT NULL DEFAULT 'NONE',
    "surgicalHistory" TEXT NOT NULL DEFAULT '',
    "allergies" TEXT NOT NULL DEFAULT '',
    "contraindications" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Patient" ("age", "allergies", "cin", "contraindications", "createdAt", "gender", "id", "insuranceProvider", "name", "phoneNumber", "surgicalHistory", "updatedAt")
SELECT "age", "allergies", "cin", "contraindications", "createdAt", "gender", "id", "insuranceProvider", "name", "phoneNumber", "surgicalHistory", "updatedAt" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_cin_key" ON "Patient"("cin");
CREATE INDEX "Patient_name_idx" ON "Patient"("name");
CREATE INDEX "Patient_cin_idx" ON "Patient"("cin");
CREATE INDEX "Patient_phoneNumber_idx" ON "Patient"("phoneNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
