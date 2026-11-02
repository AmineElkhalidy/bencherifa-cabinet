import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Protects exported CSV/Excel cells against spreadsheet formula injection
 * (CSV injection) when opened in Microsoft Excel or LibreOffice Calc.
 */
export function sanitizeSpreadsheetValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.length > 0 && FORMULA_PREFIXES.has(s[0]!)) {
    // Allow negative numbers (e.g. "-12.5") without prefixing
    if (s[0] === "-" && /^-\d+(\.\d+)?$/.test(s)) {
      return s;
    }
    return `'${s}`;
  }
  return s;
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  const escape = (v: unknown) => {
    const safe = sanitizeSpreadsheetValue(v);
    if (!safe) return "";
    const s = safe.replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };
  const head = headers.join(",");
  const body = rows
    .map((r) => headers.map((h) => escape(r[h])).join(","))
    .join("\n");
  return `\uFEFF${head}\n${body}\n`;
}

export function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : "";
}

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}
