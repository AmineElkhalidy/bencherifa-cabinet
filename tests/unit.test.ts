import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

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

process.env.SESSION_SECRET =
  "test-secret-key-with-sufficient-entropy-for-unit-tests-2026";

describe("Unit Tests — Validation Schemas", () => {
  it("validates login, user creation, and profile password change schemas", async () => {
    const {
      loginSchema,
      userCreateSchema,
      profilePasswordChangeSchema,
    } = await import("@/lib/validation/auth");

    assert.equal(
      loginSchema.safeParse({ username: "doctor", password: "Password123!" })
        .success,
      true
    );
    assert.equal(
      loginSchema.safeParse({ username: "a", password: "" }).success,
      false
    );

    // Rejects invalid characters in username
    assert.equal(
      userCreateSchema.safeParse({
        username: "bad user!",
        password: "Password123!",
        role: "DOCTOR",
      }).success,
      false
    );

    // Profile password change requires matching confirmation and distinct new password
    const samePass = profilePasswordChangeSchema.safeParse({
      currentPassword: "OldPassword123!",
      newPassword: "OldPassword123!",
      confirmPassword: "OldPassword123!",
    });
    assert.equal(samePass.success, false);

    const validPassChange = profilePasswordChangeSchema.safeParse({
      currentPassword: "OldPassword123!",
      newPassword: "NewSecurePassword123!",
      confirmPassword: "NewSecurePassword123!",
    });
    assert.equal(validPassChange.success, true);
  });

  it("validates patientSchema including age bounds and field trimming", async () => {
    const { patientSchema } = await import("@/lib/validation/patient");

    const parsed = patientSchema.safeParse({
      name: "  Fatima Zahra  ",
      age: "34",
      gender: "Female",
      cin: "AB123456",
      phoneNumber: "0612345678",
      insuranceProvider: "CNSS",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.name, "Fatima Zahra");
      assert.equal(parsed.data.cin, "AB123456");
      assert.equal(parsed.data.age, "34");
    }

    // Age "0" (newborn) should be valid, negative or >130 invalid
    assert.equal(
      patientSchema.safeParse({ name: "Bébé", age: "0", gender: "Male" })
        .success,
      true
    );
    assert.equal(
      patientSchema.safeParse({ name: "Invalid", age: "180", gender: "Male" })
        .success,
      false
    );
  });

  it("validates visitCreateSchema, consultationSchema, prescriptionSchema, and expenseSchema", async () => {
    const { visitCreateSchema } = await import("@/lib/validation/visit");
    const { consultationSchema } = await import(
      "@/lib/validation/consultation"
    );
    const { prescriptionSchema } = await import(
      "@/lib/validation/prescription"
    );
    const { expenseSchema } = await import("@/lib/validation/expense");

    assert.equal(
      visitCreateSchema.safeParse({
        patientId: "pat_1",
        visitType: "Consultation",
        price: "250",
      }).success,
      true
    );

    assert.equal(
      consultationSchema.safeParse({
        visitId: "vis_1",
        diagnosis: "Hypertension artérielle",
        clinicalNotes: "TA 150/95 mmHg",
      }).success,
      true
    );

    assert.equal(
      prescriptionSchema.safeParse({
        visitId: "vis_1",
        prescriptionDate: "2026-05-10",
        items: [
          {
            medication: "Amlodipine 5mg",
            medicationType: "Comprimé",
            duration: "30 jours",
            doseMorning: 1,
            doseNoon: 0,
            doseEvening: 0,
          },
        ],
      }).success,
      true
    );

    // Rejects empty items array in prescriptionSchema
    assert.equal(
      prescriptionSchema.safeParse({
        visitId: "vis_1",
        prescriptionDate: "2026-05-10",
        items: [],
      }).success,
      false
    );

    // Expense schema validation
    assert.equal(
      expenseSchema.safeParse({
        title: "Gants stériles",
        amount: "450.50",
        category: "Consumables",
        date: "2026-05-10",
      }).success,
      true
    );
    assert.equal(
      expenseSchema.safeParse({
        title: "Invalid negative",
        amount: "-10",
        category: "Consumables",
        date: "2026-05-10",
      }).success,
      false
    );
  });
});

describe("Unit Tests — Security, Auth, Rate Limiting & File Guards", () => {
  it("hashes passwords and verifies password tags & JWT sessions", async () => {
    const { hashPassword, verifyPassword, verifyDummyPassword } = await import(
      "@/lib/auth/password"
    );
    const { computePasswordTag, encryptSession, decryptSession } = await import(
      "@/lib/auth/session"
    );

    const hash1 = await hashPassword("ClinicPass#2026");
    assert.equal(await verifyPassword("ClinicPass#2026", hash1), true);
    assert.equal(await verifyPassword("WrongPassword", hash1), false);
    await verifyDummyPassword("TimingSafeCheck");

    const tag1 = computePasswordTag(hash1);
    const hash2 = await hashPassword("UpdatedPass#2026");
    const tag2 = computePasswordTag(hash2);
    assert.notEqual(tag1, tag2);

    const token = await encryptSession({
      userId: "usr_123",
      username: "doctor",
      role: "DOCTOR",
      pwdTag: tag1,
      expiresAt: Date.now() + 3600_000,
    });
    const decoded = await decryptSession(token);
    assert.ok(decoded);
    assert.equal(decoded.userId, "usr_123");
    assert.equal(decoded.role, "DOCTOR");
    assert.equal(decoded.pwdTag, tag1);

    // Tampered token must return null
    const tampered = token.slice(0, -4) + "XXXX";
    assert.equal(await decryptSession(tampered), null);
  });

  it("enforces login brute-force rate limiting and resets on clear", async () => {
    const {
      checkLoginRateLimit,
      recordFailedLogin,
      clearLoginRateLimit,
    } = await import("@/lib/auth/rate-limit");

    const testKey = `test-user-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      assert.equal(checkLoginRateLimit(testKey).allowed, true);
      recordFailedLogin(testKey);
    }

    const blocked = checkLoginRateLimit(testKey);
    assert.equal(blocked.allowed, false);
    assert.ok((blocked.retryAfterSeconds ?? 0) > 0);

    clearLoginRateLimit(testKey);
    assert.equal(checkLoginRateLimit(testKey).allowed, true);
  });

  it("validates file magic bytes and blocks disguised executables or scripts", async () => {
    const { detectAllowedFileExtension, resolveUpload } = await import(
      "@/lib/storage"
    );

    // Valid PNG magic header
    const pngBuf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    assert.equal(detectAllowedFileExtension(pngBuf, "image/png"), ".png");

    // Valid PDF magic header
    const pdfBuf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n", "utf8");
    assert.equal(
      detectAllowedFileExtension(pdfBuf, "application/pdf"),
      ".pdf"
    );

    // Disguised executable (MZ header) claiming to be image/png
    const exeBuf = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00");
    assert.equal(detectAllowedFileExtension(exeBuf, "image/png"), null);

    // Disguised HTML/XSS payload claiming to be image/jpeg
    const xssBuf = Buffer.from("<script>alert(1)</script>padding", "utf8");
    assert.equal(detectAllowedFileExtension(xssBuf, "image/jpeg"), null);

    // Path traversal blocked by resolveUpload
    assert.throws(() => {
      resolveUpload("../../etc/passwd");
    }, /Invalid upload path/);
    assert.throws(() => {
      resolveUpload("..\\..\\Windows\\win.ini");
    }, /Invalid upload path/);
  });

  it("sanitizes CSV / spreadsheet values against formula injection", async () => {
    const { sanitizeSpreadsheetValue, toCsv } = await import(
      "@/lib/backup/csv"
    );

    assert.equal(
      sanitizeSpreadsheetValue("=CMD|' /C calc'!A0"),
      "'=CMD|' /C calc'!A0"
    );
    assert.equal(sanitizeSpreadsheetValue("+SUM(A1:A2)"), "'+SUM(A1:A2)");
    assert.equal(sanitizeSpreadsheetValue("@HYPERLINK(...)"), "'@HYPERLINK(...)");
    assert.equal(sanitizeSpreadsheetValue("-250"), "-250"); // Numeric negative preserved
    assert.equal(sanitizeSpreadsheetValue("-cmd()"), "'-cmd()");

    const csv = toCsv(
      ["name", "note"],
      [{ name: "=Malicious", note: 'Line with "quotes", comma' }]
    );
    assert.ok(csv.includes("'=Malicious"));
    assert.ok(csv.includes('"Line with ""quotes"", comma"'));
  });

  it("computes expense summaries and accent-insensitive search matching", async () => {
    const { summarizeExpenses } = await import("@/lib/expenses");
    const { matchesSearchQuery } = await import("@/lib/search");

    const now = new Date("2026-05-15T12:00:00Z");
    const summary = summarizeExpenses(
      [
        {
          id: "1",
          title: "Loyer Mai",
          amount: 5000,
          category: "Rent",
          date: "2026-05-01T00:00:00Z",
          notes: "",
        },
        {
          id: "2",
          title: "Consommables",
          amount: 1200,
          category: "Consumables",
          date: "2026-05-10T00:00:00Z",
          notes: "",
        },
        {
          id: "3",
          title: "Janvier Équipement",
          amount: 8000,
          category: "Medical Equipment",
          date: "2026-01-10T00:00:00Z",
          notes: "",
        },
      ],
      now
    );

    assert.equal(summary.monthTotal, 6200);
    assert.equal(summary.yearTotal, 14200);
    assert.equal(summary.topCategory.category, "Rent");
    assert.equal(summary.topCategory.total, 5000);

    // Search matching handles accents and multiple tokens
    assert.equal(
      matchesSearchQuery(
        ["Chérifa Benali", "Gastrite aiguë", "AB123456"],
        "cherifa aigue"
      ),
      true
    );
    assert.equal(
      matchesSearchQuery(["Chérifa Benali"], "cherifa missingtoken"),
      false
    );
  });
});
